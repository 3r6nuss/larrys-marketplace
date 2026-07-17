import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle2, Database, Download, FileJson, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

function TableSelector({ tables, selected, onToggle, disabled, showBackupCounts = false }) {
 return (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
   {tables.map(table => {
    const isSelected = selected.includes(table.name);
    return (
     <button
      type="button"
      key={table.name}
      disabled={disabled || table.available === false}
      onClick={() => onToggle(table.name)}
      className={`min-h-16 flex items-center justify-between gap-3 rounded-md border p-3 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
       isSelected ? 'border-primary bg-primary/10' : 'border-border bg-background/40 hover:bg-muted/50'
      }`}
     >
      <span className="min-w-0">
       <span className="block text-sm font-semibold truncate">{table.label}</span>
       <span className="block text-xs text-muted-foreground">
        {showBackupCounts ? `${table.backupCount ?? 0} Zeilen im Backup` : `${table.count ?? 0} Zeilen`}
       </span>
      </span>
      <span className={`h-5 w-5 shrink-0 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
       {isSelected && <CheckCircle2 className="h-4 w-4" />}
      </span>
     </button>
    );
   })}
  </div>
 );
}

export default function BackupPage() {
 const { hasRole } = useAuth();
 const fileRef = useRef(null);
 const [tables, setTables] = useState([]);
 const [exportTables, setExportTables] = useState([]);
 const [importTables, setImportTables] = useState([]);
 const [backup, setBackup] = useState(null);
 const [backupName, setBackupName] = useState('');
 const [loading, setLoading] = useState(true);
 const [exporting, setExporting] = useState(false);
 const [importing, setImporting] = useState(false);

 useEffect(() => {
  fetch('/api/backup/tables', { credentials: 'include' })
   .then(async response => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Tabellen konnten nicht geladen werden.');
    setTables(data.tables);
    setExportTables(data.tables.map(table => table.name));
   })
   .catch(error => toast.error(error.message))
   .finally(() => setLoading(false));
 }, []);

 const toggleTable = (setter, name) => setter(current => (
  current.includes(name) ? current.filter(table => table !== name) : [...current, name]
 ));

 const exportBackup = async () => {
  if (exportTables.length === 0) return toast.error('Wähle mindestens eine Tabelle aus.');
  setExporting(true);
  try {
   const response = await fetch('/api/backup/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ tables: exportTables }),
   });
   if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Backup konnte nicht erstellt werden.');
   }
   const blob = await response.blob();
   const disposition = response.headers.get('Content-Disposition') || '';
   const filename = disposition.match(/filename="([^"]+)"/)?.[1] || 'larrys-backup.json';
   const url = URL.createObjectURL(blob);
   const link = document.createElement('a');
   link.href = url;
   link.download = filename;
   link.click();
   URL.revokeObjectURL(url);
   toast.success('Backup wurde heruntergeladen.');
  } catch (error) {
   toast.error(error.message);
  } finally {
   setExporting(false);
  }
 };

 const loadBackupFile = async event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) return toast.error('Die Backup-Datei darf höchstens 50 MB groß sein.');
  try {
   const parsed = JSON.parse(await file.text());
   if (parsed?.version !== 1 || !parsed.tables || typeof parsed.tables !== 'object') {
    throw new Error('Datei ist kein unterstütztes Larrys-Backup.');
   }
   const availableNames = new Set(tables.map(table => table.name));
   const includedTables = Object.keys(parsed.tables).filter(name => availableNames.has(name) && Array.isArray(parsed.tables[name]));
   if (includedTables.length === 0) throw new Error('Das Backup enthält keine unterstützten Tabellen.');
   setBackup(parsed);
   setBackupName(file.name);
   setImportTables(includedTables);
   toast.success('Backup-Datei wurde geprüft und geladen.');
  } catch (error) {
   setBackup(null);
   setBackupName('');
   setImportTables([]);
   toast.error(error.message || 'Backup-Datei konnte nicht gelesen werden.');
  }
 };

 const importBackup = async () => {
  if (!backup || importTables.length === 0) return toast.error('Lade ein Backup und wähle Tabellen aus.');
  if (!window.confirm(`Die ausgewählten Tabellen werden vollständig ersetzt.\n\n${importTables.length} Tabelle(n) wiederherstellen?`)) return;
  setImporting(true);
  try {
   const response = await fetch('/api/backup/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ backup, tables: importTables, confirmation: 'WIEDERHERSTELLEN' }),
   });
   const data = await response.json();
   if (!response.ok) throw new Error(data.error || 'Backup konnte nicht wiederhergestellt werden.');
   toast.success(`${data.tables.length} Tabelle(n) wurden wiederhergestellt.`);
   setTables(current => current.map(table => (
    data.row_counts[table.name] === undefined ? table : { ...table, count: data.row_counts[table.name] }
   )));
  } catch (error) {
   toast.error(error.message);
  } finally {
   setImporting(false);
  }
 };

 if (!hasRole('superadmin')) return <p className="text-destructive">Keine Berechtigung.</p>;

 const importOptions = tables.map(table => ({
  ...table,
  available: Array.isArray(backup?.tables?.[table.name]),
  backupCount: backup?.tables?.[table.name]?.length,
 }));

 return (
  <div className="space-y-6">
   <div>
    <h1 className="text-2xl font-bold flex items-center gap-2"><Database className="h-6 w-6 text-primary" /> Datenbank-Backups</h1>
    <p className="text-sm text-muted-foreground mt-1">Geschäftstabellen einzeln sichern oder aus einem Larrys-Backup wiederherstellen.</p>
   </div>

   <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
    <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
    <p>Backups enthalten Datenbankeinträge und Bildpfade, aber keine Dateien aus dem Upload-Volume. Sitzungen, Rate-Limits und Audit-Logs werden nicht gesichert.</p>
   </div>

   <Tabs defaultValue="export">
    <TabsList>
     <TabsTrigger value="export" className="gap-2 cursor-pointer"><Download className="h-4 w-4" /> Backup erstellen</TabsTrigger>
     <TabsTrigger value="import" className="gap-2 cursor-pointer"><Upload className="h-4 w-4" /> Backup hochladen</TabsTrigger>
    </TabsList>

    <TabsContent value="export" className="mt-4">
     <Card>
      <CardHeader>
       <CardTitle>Tabellen exportieren</CardTitle>
       <CardDescription>Wähle die Tabellen aus, die in die JSON-Datei aufgenommen werden.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
       {loading ? <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div> : (
        <TableSelector tables={tables} selected={exportTables} onToggle={name => toggleTable(setExportTables, name)} disabled={exporting} />
       )}
       <div className="flex justify-between items-center gap-3 border-t pt-4">
        <Badge variant="outline">{exportTables.length} von {tables.length} Tabellen</Badge>
        <Button onClick={exportBackup} disabled={loading || exporting || exportTables.length === 0} className="gap-2 cursor-pointer">
         {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} JSON herunterladen
        </Button>
       </div>
      </CardContent>
     </Card>
    </TabsContent>

    <TabsContent value="import" className="mt-4">
     <Card>
      <CardHeader>
       <CardTitle>Tabellen wiederherstellen</CardTitle>
       <CardDescription>Die ausgewählten Tabellen werden vollständig durch die Daten aus dem Backup ersetzt.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
       <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={loadBackupFile} />
       <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing} className="gap-2 cursor-pointer">
        <FileJson className="h-4 w-4" /> JSON-Datei auswählen
       </Button>
       {backup && (
        <>
         <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p className="font-semibold break-all">{backupName}</p>
          <p className="text-muted-foreground mt-1">Erstellt: {backup.metadata?.created_at ? new Date(backup.metadata.created_at).toLocaleString('de-DE') : 'Unbekannt'}</p>
         </div>
         <TableSelector tables={importOptions} selected={importTables} onToggle={name => toggleTable(setImportTables, name)} disabled={importing} showBackupCounts />
         <div className="flex justify-between items-center gap-3 border-t pt-4">
          <Badge variant="outline">{importTables.length} Tabelle(n) ausgewählt</Badge>
          <Button variant="destructive" onClick={importBackup} disabled={importing || importTables.length === 0} className="gap-2 cursor-pointer">
           {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Tabellen ersetzen
          </Button>
         </div>
        </>
       )}
      </CardContent>
     </Card>
    </TabsContent>
   </Tabs>
  </div>
 );
}