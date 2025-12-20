'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/lib/components/ui/dialog';
import { Button } from '@/lib/components/ui/button';
import { Label } from '@/lib/components/ui/label';
import { Input } from '@/lib/components/ui/input';
import { Loader2, CheckCircle2, XCircle, Download } from 'lucide-react';
import { HelpIcon } from '@/lib/components/ui/help-icon';
import Link from 'next/link';

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const CSV_TEMPLATE = `name,email,phone,roles
John Doe,john@example.com,+251911000001,"BUILDING_MANAGER,FACILITY_MANAGER"
Jane Smith,jane@example.com,+251911000002,ACCOUNTANT`;

export function CSVImportDialog({ open, onOpenChange, onSuccess }: CSVImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    total: number;
    successful: number;
    failed: number;
    results: Array<{ row: number; identifier: string; success: boolean; error?: string }>;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResults(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/users/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        setResults(data);
        if (onSuccess) onSuccess();
      } else {
        setResults({
          total: 0,
          successful: 0,
          failed: 0,
          results: [{ row: 0, identifier: 'File', success: false, error: data.error }],
        });
      }
    } catch (error) {
      console.error('CSV import error:', error);
      setResults({
        total: 0,
        successful: 0,
        failed: 0,
        results: [{ row: 0, identifier: 'File', success: false, error: 'Failed to import CSV' }],
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users-import-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Import Users from CSV
            <HelpIcon content="Upload a CSV file to bulk import users. The file must include phone and roles columns. Email is required if sending invitations." />
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import users. Users will be invited via email.
          </DialogDescription>
        </DialogHeader>

        {!results ? (
          <div className="space-y-4">
            <div>
              <Label>CSV File</Label>
              <div className="mt-2 space-y-2">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  CSV format: name, email, phone, roles (comma-separated roles)
                </p>
              </div>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                    CSV Format Requirements
                  </p>
                  <ul className="text-xs text-blue-700 dark:text-blue-300 mt-2 space-y-1 list-disc list-inside">
                    <li>Required columns: phone, roles</li>
                    <li>Optional columns: name, email</li>
                    <li>
                      Roles can be comma-separated (e.g.,
                      &quot;BUILDING_MANAGER,FACILITY_MANAGER&quot;)
                    </li>
                    <li>Email is required if sending invitations</li>
                  </ul>
                </div>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={!file || loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  'Import Users'
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold">{results.total}</div>
                <div className="text-sm text-muted-foreground">Total Rows</div>
              </div>
              <div className="text-center p-4 border rounded-lg bg-green-50 dark:bg-green-900/20">
                <div className="text-2xl font-bold text-green-600">{results.successful}</div>
                <div className="text-sm text-muted-foreground">Successful</div>
              </div>
              <div className="text-center p-4 border rounded-lg bg-red-50 dark:bg-red-900/20">
                <div className="text-2xl font-bold text-red-600">{results.failed}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
            </div>

            {results.results.length > 0 && (
              <div className="max-h-64 overflow-y-auto space-y-1">
                <p className="text-sm font-semibold mb-2">Import Results:</p>
                {results.results.map((result, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 border rounded text-sm">
                    {result.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="w-16 text-xs text-muted-foreground">Row {result.row}</span>
                    <span className="flex-1">{result.identifier}</span>
                    {result.error && (
                      <span className="text-xs text-red-600 max-w-xs truncate">{result.error}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
