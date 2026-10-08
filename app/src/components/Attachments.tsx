// Files on a record: scans of the sign-off card, tech log page, logbooks,
// photos (D-065).
//
// Rules (enforced by the database and the file store, not just here):
//   * PDF and images only, up to 20 MB (D-026)
//   * You can add or open a file only if you can see its record (D-125)
//   * Files are never deleted or replaced (D-023)
//
// Order matters: the file goes into the store FIRST, then its record is
// written. That way a scan can never be listed as "attached" unless the file
// really arrived.
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { db, errorText } from '../lib/supabase';
import { formatDateTime } from '../lib/format';

export const KIND_LABEL: Record<string, string> = {
  sign_off_card: 'Sign-off card',
  tech_log_page: 'Tech log page',
  aircraft_logbook: 'Aircraft logbook',
  engine_logbook: 'Engine logbook',
  photo: 'Photo',
  document: 'Document',
};

const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_BYTES = 20 * 1024 * 1024;

type FileRow = {
  id: string; kind: string; file_name: string; size_bytes: number; storage_path: string;
  created_at: string; superseded_by: string | null;
  uploader: { three_letter_code: string } | null;
};

function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('');
}

// Problems with a chosen file, in words, before anything is sent (D-026).
export function fileProblem(file: { type: string; size: number }): string | null {
  if (!ALLOWED.includes(file.type)) return 'Only PDF and images (JPEG, PNG, WEBP, HEIC) can be attached (D-026).';
  if (file.size > MAX_BYTES) return 'The file is larger than 20 MB.';
  if (file.size === 0) return 'The file is empty.';
  return null;
}

type Props = {
  recordTable: 'work_order' | 'snag';
  recordId: string;
  kinds: string[];          // kinds offered for upload
  canUpload: boolean;
  onChange?: () => void;    // e.g. re-check "missing scans"
};

export function Attachments({ recordTable, recordId, kinds, canUpload, onChange }: Props) {
  const { display, me } = useAuth();
  const [files, setFiles] = useState<FileRow[]>([]);
  const [kind, setKind] = useState(kinds[0]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  const load = useCallback(async () => {
    const { data } = await db.from('attachment')
      .select('id, kind, file_name, size_bytes, storage_path, created_at, superseded_by, uploader:uploaded_by (three_letter_code)')
      .eq('record_table', recordTable).eq('record_id', recordId)
      .order('created_at');
    setFiles((data ?? []) as unknown as FileRow[]);
  }, [recordTable, recordId]);

  useEffect(() => { load(); }, [load]);

  async function upload() {
    setError('');
    if (!file) return setError('Choose a file first.');
    const problem = fileProblem(file);
    if (problem) return setError(problem);
    setBusy(true);
    const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80);
    const path = `${recordTable}/${recordId}/${newId()}-${safeName}`;
    const { error: upErr } = await db.storage.from('attachments').upload(path, file, { contentType: file.type });
    if (upErr) {
      setBusy(false);
      return setError(errorText(upErr));
    }
    const { error: rowErr } = await db.from('attachment').insert({
      record_table: recordTable, record_id: recordId, kind, file_name: file.name,
      mime_type: file.type, size_bytes: file.size, storage_path: path,
      uploaded_by: me?.personId ?? '', // the database sets this to you regardless (D-024)
      device_time: new Date().toISOString(),
    });
    setBusy(false);
    if (rowErr) return setError(errorText(rowErr));
    setFile(null);
    setInputKey((k) => k + 1);
    await load();
    onChange?.();
  }

  // Open the tab straight away (browsers block tabs opened after a wait),
  // then point it at a link that works for 2 minutes only.
  async function open(f: FileRow) {
    const tab = window.open('', '_blank');
    const { data, error: err } = await db.storage.from('attachments').createSignedUrl(f.storage_path, 120);
    if (err || !data) {
      tab?.close();
      return setError(errorText(err));
    }
    if (tab) {
      tab.opener = null;
      tab.location.href = data.signedUrl;
    } else {
      window.location.href = data.signedUrl;
    }
  }

  return (
    <div>
      {files.length === 0 && <p className="small muted">No files attached yet.</p>}
      {files.length > 0 && (
        <ul className="open-list">
          {files.map((f) => (
            <li key={f.id} className={f.superseded_by ? 'superseded' : ''}>
              <span className="chip tone-grey">{KIND_LABEL[f.kind] ?? f.kind}</span>
              <button type="button" className="link-button" onClick={() => open(f)}>{f.file_name}</button>
              <span className="small muted">
                {(f.size_bytes / 1024 / 1024).toFixed(1)} MB · <span className="mono">{f.uploader?.three_letter_code}</span> · {formatDateTime(f.created_at, display)}
                {f.superseded_by && ' · superseded'}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canUpload && (
        <div className="upload-row">
          <select aria-label="What is this file?" value={kind} onChange={(e) => setKind(e.target.value)}>
            {kinds.map((k) => <option key={k} value={k}>{KIND_LABEL[k] ?? k}</option>)}
          </select>
          <input key={inputKey} type="file" accept="application/pdf,image/*"
            aria-label="Choose a file or take a photo" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button type="button" onClick={upload} disabled={busy}>{busy ? 'Uploading…' : 'Attach'}</button>
        </div>
      )}
      {error && <div className="error" role="alert">{error}</div>}
    </div>
  );
}
