import ModalBackdrop from './ModalBackdrop'
import React, { useState } from 'react'
import { AlertCircle, Check, Download, FileSpreadsheet, Upload, X } from 'lucide-react'
import { api, type BulkImportMember, type PlanDto } from '../../api'

interface CsvImportModalProps {
  plans: PlanDto[]
  onClose: () => void
  onSuccess: (importedCount: number) => void
  onToast: (msg: string) => void
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  plans,
  onClose,
  onSuccess,
  onToast,
}) => {
  const [csvText, setCsvText] = useState('')
  const [parsedRows, setParsedRows] = useState<BulkImportMember[]>([])
  const [parsingErrors, setParsingErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<{ count: number; errors: string[] } | null>(null)

  // Download Sample CSV
  const handleDownloadSample = () => {
    const defaultPlanName = plans[0]?.name || 'Standard Monthly'
    const sample = [
      'Name,Phone,Email,Plan,StartDate,PaymentStatus,PaymentMethod',
      `Rahul Verma,9876543210,rahul@example.com,${defaultPlanName},2026-11-01,PAID,CASH`,
      `Pooja Sharma,9811122233,pooja@example.com,${defaultPlanName},2026-11-10,PAID,UPI_OFFLINE`,
      `Amit Kumar,9988776655,,${defaultPlanName},2026-11-15,PENDING,CASH`,
    ].join('\n')

    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'gym_members_sample.csv'
    link.click()
    onToast('Sample CSV template downloaded!')
  }

  // Parse CSV
  const parseCsv = (text: string) => {
    const lines: string[][] = []
    let row: string[] = []
    let field = ''
    let quoted = false
    const finishRow = () => {
      row.push(field.trim())
      if (row.some(Boolean)) lines.push(row)
      row = []
      field = ''
    }
    for (let index = 0; index < text.length; index++) {
      const char = text[index]
      if (char === '"') {
        if (quoted && text[index + 1] === '"') {
          field += '"'
          index++
        } else {
          quoted = !quoted
        }
      } else if (char === ',' && !quoted) {
        row.push(field.trim())
        field = ''
      } else if (char === '\n' && !quoted) {
        finishRow()
      } else {
        field += char
      }
    }
    if (quoted) {
      setParsingErrors(['A quoted field is missing its closing quotation mark.'])
      setParsedRows([])
      return
    }
    finishRow()
    if (lines.length < 2) {
      setParsingErrors(['CSV file must have a header row and at least 1 member record.'])
      setParsedRows([])
      return
    }

    const headers = lines[0].map(h => h.trim().toLowerCase())
    const nameIdx = headers.findIndex(h => h.includes('name'))
    const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile') || h.includes('contact'))
    const emailIdx = headers.findIndex(h => h.includes('email'))
    const planIdx = headers.findIndex(h => h.includes('plan'))
    const dateIdx = headers.findIndex(h => h.includes('start') || h.includes('date'))
    const payStatusIdx = headers.findIndex(h => h.includes('status') || h.includes('payment'))
    const payMethodIdx = headers.findIndex(h => h.includes('method'))

    if (nameIdx === -1 || phoneIdx === -1) {
      setParsingErrors(['CSV header must include at least "Name" and "Phone" columns.'])
      setParsedRows([])
      return
    }

    const rows: BulkImportMember[] = []
    const errs: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i]
      const name = cols[nameIdx] || ''
      const phone = cols[phoneIdx] || ''
      const email = emailIdx !== -1 ? cols[emailIdx] : undefined
      const planName = planIdx !== -1 ? cols[planIdx] : undefined
      const startDate = dateIdx !== -1 ? cols[dateIdx] : undefined
      const statusRaw = payStatusIdx !== -1 ? cols[payStatusIdx]?.toUpperCase() : 'PAID'
      const methodRaw = payMethodIdx !== -1 ? cols[payMethodIdx]?.toUpperCase() : 'CASH'

      if (!name) {
        errs.push(`Row ${i}: Missing name`)
        continue
      }
      if (!phone || phone.replace(/\D/g, '').length < 8) {
        errs.push(`Row ${i} (${name}): Invalid phone number "${phone}"`)
        continue
      }

      rows.push({
        name,
        phone,
        email: email || undefined,
        planName: planName || undefined,
        startDate: startDate || undefined,
        paymentStatus: statusRaw === 'PENDING' ? 'PENDING' : 'PAID',
        paymentMethod:
          methodRaw === 'UPI' || methodRaw === 'UPI_OFFLINE'
            ? 'UPI_OFFLINE'
            : methodRaw === 'BANK' || methodRaw === 'BANK_TRANSFER'
            ? 'BANK_TRANSFER'
            : 'CASH',
      })
    }

    setParsingErrors(errs)
    setParsedRows(rows)
  }

  // Handle File Input
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = evt => {
      const text = String(evt.target?.result || '')
      setCsvText(text)
      parseCsv(text)
    }
    reader.readAsText(file)
  }

  // Submit Import
  const handleImport = async () => {
    if (parsedRows.length === 0) return
    setImporting(true)
    try {
      const res = await api<{ success: boolean; count: number; total: number; errors: string[] }>(
        '/members/import',
        {
          method: 'POST',
          body: JSON.stringify({ members: parsedRows }),
        }
      )
      setImportResults(res)
      if (res.count > 0) {
        onSuccess(res.count)
        onToast(`Successfully imported ${res.count} members!`)
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <ModalBackdrop label="Import members" onClose={onClose}>
      <div className="modal-card csv-import-modal">
        <div className="modal-header">
          <div className="modal-header-icon-title">
            <div className="header-icon-box sage">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3>Import members from CSV</h3>
              <p>Easily onboard 100+ members from your existing spreadsheets</p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {importResults ? (
            <div className="import-success-box">
              <div className="success-badge-large">
                <Check size={32} />
              </div>
              <h4>{importResults.count} Members Imported Successfully!</h4>
              {importResults.errors.length > 0 && (
                <div className="import-partial-errors">
                  <p>Some rows could not be imported:</p>
                  <ul>
                    {importResults.errors.slice(0, 5).map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                    {importResults.errors.length > 5 && (
                      <li>...and {importResults.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Template Download Row */}
              <div className="csv-template-notice">
                <div>
                  <strong>Need an example?</strong>
                  <span>Download our pre-formatted template with standard columns.</span>
                </div>
                <button
                  type="button"
                  className="button button-secondary text-sm"
                  onClick={handleDownloadSample}
                >
                  <Download size={14} /> Download Sample CSV
                </button>
              </div>

              {/* Upload Drop Area */}
              <div className="csv-dropzone">
                <input
                  type="file"
                  id="csv-file-input"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="csv-file-hidden"
                />
                <label htmlFor="csv-file-input" className="csv-dropzone-label">
                  <Upload size={28} className="upload-icon" />
                  <span>
                    Choose a CSV file
                  </span>
                  <small>Accepts .csv exported from Excel or Google Sheets</small>
                </label>
              </div>

              {/* Paste or Preview */}
              {parsedRows.length > 0 && (
                <div className="csv-preview-table-wrap">
                  <div className="preview-table-header">
                    <span>
                      Preview: <strong>{parsedRows.length} members ready to import</strong>
                    </span>
                    {parsingErrors.length > 0 && (
                      <span className="error-chip">
                        <AlertCircle size={13} /> {parsingErrors.length} warnings
                      </span>
                    )}
                  </div>
                  <div className="table-scroll-container">
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Name</th>
                          <th>Phone</th>
                          <th>Plan</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.slice(0, 10).map((row, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td>{row.name}</td>
                            <td>{row.phone}</td>
                            <td>{row.planName || 'Standard'}</td>
                            <td>
                              <span className={`pill-status ${row.paymentStatus === 'PAID' ? 'active' : 'pending'}`}>
                                {row.paymentStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedRows.length > 10 && (
                    <div className="preview-more-hint">
                      ...and {parsedRows.length - 10} more members
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="button button-secondary" onClick={onClose}>
            {importResults ? 'Close' : 'Cancel'}
          </button>
          {!importResults && (
            <button
              type="button"
              className="button button-primary"
              disabled={parsedRows.length === 0 || importing}
              onClick={handleImport}
            >
              {importing ? 'Importing...' : `Import ${parsedRows.length} Members`}
            </button>
          )}
        </div>
      </div>
    </ModalBackdrop>
  )
}

export default CsvImportModal
