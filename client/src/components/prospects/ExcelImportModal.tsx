import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { apiRequest } from "../../services/api";
import { Modal } from "../ui/Modal";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronRight,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Folder,
  ShieldCheck,
} from "lucide-react";

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  lists: Array<{ id: string; name: string; color?: string }>;
  defaultListId?: string;
  onSuccess: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  lists,
  defaultListId,
  onSuccess,
}) => {
  // Obtenir un ID de liste initial valide (jamais "ALL" ou "DO_NOT_CONTACT")
  const getValidListId = () => {
    if (defaultListId && defaultListId !== "ALL" && defaultListId !== "DO_NOT_CONTACT") {
      const match = lists.find((l) => l.id === defaultListId);
      if (match) return match.id;
    }
    if (lists && lists.length > 0) return lists[0].id;
    return "";
  };

  const [selectedListId, setSelectedListId] = useState<string>(getValidListId());

  // Synchronisation dynamique : dès que le modal s'ouvre ou que les listes changent
  useEffect(() => {
    if (isOpen) {
      const valid = getValidListId();
      if (valid && (!selectedListId || !lists.some((l) => l.id === selectedListId))) {
        setSelectedListId(valid);
      }
    }
  }, [isOpen, defaultListId, lists]);

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [step, setStep] = useState<"UPLOAD" | "MAPPING" | "SUCCESS">("UPLOAD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    createdCount: number;
    duplicateCount: number;
    teamCollisionsCount?: number;
    teamCollisions?: Array<{ linkedinUrl: string; ownerName: string }>;
  } | null>(null);

  // Column mapping states
  const [mapping, setMapping] = useState<{
    firstName: string;
    lastName: string;
    linkedinUrl: string;
    company: string;
    headline: string;
    email: string;
    phone: string;
  }>({
    firstName: "",
    lastName: "",
    linkedinUrl: "",
    company: "",
    headline: "",
    email: "",
    phone: "",
  });


  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    // S'assurer qu'un ID de liste cible valide est bien actif
    if (!selectedListId || !lists.some((l) => l.id === selectedListId)) {
      const valid = getValidListId();
      if (valid) setSelectedListId(valid);
    }

    setFile(uploadedFile);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (!data || data.length < 2) {
          setError("Le fichier ne contient aucune ligne de données exploitable.");
          return;
        }

        const headers = data[0].map((h: any) => String(h || "").trim());
        setRawHeaders(headers);

        const rows = data.slice(1).map((row) => {
          const rowObj: Record<string, string> = {};
          headers.forEach((h, index) => {
            rowObj[h] = row[index] ? String(row[index]).trim() : "";
          });
          return rowObj;
        });

        setParsedRows(rows.filter((r) => Object.values(r).some((v) => v !== "")));

        // Intelligent auto-detection of columns
        const detectedMapping = {
          firstName: "",
          lastName: "",
          linkedinUrl: "",
          company: "",
          headline: "",
          email: "",
          phone: "",
        };

        headers.forEach((h) => {
          const lower = h.toLowerCase();
          if (!detectedMapping.firstName && (lower.includes("prénom") || lower.includes("firstname") || lower === "first")) {
            detectedMapping.firstName = h;
          } else if (!detectedMapping.lastName && (lower.includes("nom") || lower.includes("lastname") || lower === "last")) {
            detectedMapping.lastName = h;
          } else if (!detectedMapping.linkedinUrl && (lower.includes("linkedin") || lower.includes("profil") || lower.includes("url"))) {
            detectedMapping.linkedinUrl = h;
          } else if (!detectedMapping.company && (lower.includes("entreprise") || lower.includes("company") || lower.includes("société"))) {
            detectedMapping.company = h;
          } else if (!detectedMapping.headline && (lower.includes("poste") || lower.includes("titre") || lower.includes("headline") || lower.includes("job"))) {
            detectedMapping.headline = h;
          } else if (!detectedMapping.email && (lower.includes("email") || lower.includes("mail") || lower.includes("courriel"))) {
            detectedMapping.email = h;
          } else if (!detectedMapping.phone && (lower.includes("tel") || lower.includes("phone") || lower.includes("mobile"))) {
            detectedMapping.phone = h;
          }
        });

        // Fallback: if single "Nom complet" or "Name", map to firstName
        if (!detectedMapping.firstName && !detectedMapping.lastName) {
          const fullNameCol = headers.find((h) => h.toLowerCase().includes("nom") || h.toLowerCase().includes("name"));
          if (fullNameCol) detectedMapping.firstName = fullNameCol;
        }

        setMapping(detectedMapping);
        setStep("MAPPING");
      } catch (err: any) {
        setError("Erreur lors de la lecture du fichier : " + err.message);
      }
    };

    reader.readAsBinaryString(uploadedFile);
  };

  const handleConfirmImport = async () => {
    const targetListId =
      selectedListId ||
      (defaultListId && defaultListId !== "ALL" && defaultListId !== "DO_NOT_CONTACT" ? defaultListId : "") ||
      (lists.length > 0 ? lists[0].id : "");

    if (!targetListId) {
      setError("Veuillez sélectionner une liste de destination.");
      return;
    }

    if (selectedListId !== targetListId) {
      setSelectedListId(targetListId);
    }

    if (!mapping.linkedinUrl && !mapping.firstName) {
      setError("Veuillez mapper au minimum la colonne LinkedIn URL ou Prénom.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const prospectsToImport = parsedRows
        .map((row) => {
          let firstName = mapping.firstName ? row[mapping.firstName] || "" : "";
          let lastName = mapping.lastName ? row[mapping.lastName] || "" : "";

          // Split if single full name column
          if (firstName && !lastName && firstName.includes(" ")) {
            const parts = firstName.split(" ");
            firstName = parts[0];
            lastName = parts.slice(1).join(" ");
          }

          const linkedinUrl = mapping.linkedinUrl ? row[mapping.linkedinUrl] || "" : "";
          const cleanLinkedinUrl = linkedinUrl || `https://linkedin.com/in/${encodeURIComponent((firstName + "-" + lastName).toLowerCase())}`;

          return {
            firstName: firstName || "Contact",
            lastName: lastName || "Importé",
            linkedinUrl: cleanLinkedinUrl,
            company: mapping.company ? row[mapping.company] || "" : "",
            headline: mapping.headline ? row[mapping.headline] || "" : "",
            email: mapping.email ? row[mapping.email] || "" : "",
            phone: mapping.phone ? row[mapping.phone] || "" : "",
            tags: ["Import Excel"],
          };
        })
        .filter((p) => p.linkedinUrl);

      const res = await apiRequest<{
        createdCount: number;
        duplicateCount: number;
        teamCollisionsCount?: number;
        teamCollisions?: Array<{ linkedinUrl: string; ownerName: string }>;
        message: string;
      }>("/prospects/bulk", {
        method: "POST",
        body: JSON.stringify({
          listId: targetListId,
          prospects: prospectsToImport,
        }),
      });

      if (res.success) {
        setImportResult({
          createdCount: res.createdCount,
          duplicateCount: res.duplicateCount,
          teamCollisionsCount: res.teamCollisionsCount || 0,
          teamCollisions: res.teamCollisions || [],
        });
        setStep("SUCCESS");
        onSuccess();
      } else {
        setError(res.error || "Erreur lors de l'importation.");
      }
    } catch (err: any) {
      setError(err.message || "Erreur réseau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose} size="lg" title="Importer des prospects" description="Fichier Excel ou CSV (.xlsx, .xls, .csv)." bodyClassName="px-6 pb-6">
      <div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-surface-2 border border-line text-danger text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: UPLOAD */}
        {step === "UPLOAD" && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-ink">
                  1. Choisir la Liste de destination
                </label>
                {lists.length > 0 && (
                  <span className="text-xs text-ink font-semibold">
                    {lists.length} liste(s) disponible(s)
                  </span>
                )}
              </div>
              <select
                value={selectedListId || (lists.length > 0 ? lists[0].id : "")}
                onChange={(e) => {
                  setSelectedListId(e.target.value);
                  setError(null);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-white text-xs text-ink-2 font-semibold focus:outline-none focus:border-ink cursor-pointer"
              >
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Drag and Drop Zone */}
            <div>
              <label className="block text-xs font-medium text-ink mb-2">
                2. Déposer votre fichier
              </label>
              <label className="border-2 border-dashed border-line hover:border-ink rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-surface-2 hover:bg-[#f3f0fd]">
                <UploadCloud className="w-10 h-10 text-ink mb-3" />
                <p className="text-xs font-medium text-ink mb-1">
                  Glissez-déposez votre fichier ici, ou cliquez pour parcourir
                </p>
                <p className="text-xs text-muted">.xlsx, .xls ou .csv (taille max: 10 Mo)</p>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {/* STEP 2: MAPPING & PREVIEW */}
        {step === "MAPPING" && (
          <div className="space-y-5">
            {/* Target List Selector & File Summary Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-surface-2 border border-ink">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface-2 text-ink flex items-center justify-center shrink-0">
                  <Folder className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted">
                      Liste de destination :
                    </span>
                    <select
                      value={selectedListId || (lists.length > 0 ? lists[0].id : "")}
                      onChange={(e) => {
                        setSelectedListId(e.target.value);
                        setError(null);
                      }}
                      className="px-2.5 py-1 rounded-xl border border-ink bg-white text-xs font-medium text-ink focus:outline-none focus:border-ink cursor-pointer"
                    >
                      {lists.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    {parsedRows.length} lignes détectées dans <span className="font-semibold text-ink">{file?.name}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep("UPLOAD")}
                className="text-xs text-ink hover:underline font-semibold shrink-0 self-start sm:self-center"
              >
                Changer de fichier
              </button>
            </div>

            {/* Mapping Grid */}
            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-surface-2 border border-line max-h-64 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Prénom
                </label>
                <select
                  value={mapping.firstName}
                  onChange={(e) => setMapping({ ...mapping, firstName: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-line text-xs bg-white focus:outline-none focus:border-ink"
                >
                  <option value="">(Ignorer)</option>
                  {rawHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Nom de famille
                </label>
                <select
                  value={mapping.lastName}
                  onChange={(e) => setMapping({ ...mapping, lastName: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-line text-xs bg-white focus:outline-none focus:border-ink"
                >
                  <option value="">(Ignorer)</option>
                  {rawHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  URL Profil LinkedIn *
                </label>
                <select
                  value={mapping.linkedinUrl}
                  onChange={(e) => setMapping({ ...mapping, linkedinUrl: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-line text-xs bg-white focus:outline-none focus:border-ink"
                >
                  <option value="">(Ignorer)</option>
                  {rawHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Entreprise
                </label>
                <select
                  value={mapping.company}
                  onChange={(e) => setMapping({ ...mapping, company: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-line text-xs bg-white focus:outline-none focus:border-ink"
                >
                  <option value="">(Ignorer)</option>
                  {rawHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Titre / Poste
                </label>
                <select
                  value={mapping.headline}
                  onChange={(e) => setMapping({ ...mapping, headline: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-line text-xs bg-white focus:outline-none focus:border-ink"
                >
                  <option value="">(Ignorer)</option>
                  {rawHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Email
                </label>
                <select
                  value={mapping.email}
                  onChange={(e) => setMapping({ ...mapping, email: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-line text-xs bg-white focus:outline-none focus:border-ink"
                >
                  <option value="">(Ignorer)</option>
                  {rawHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted">
                Déduplication active : les doublons seront ignorés.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-line text-xs font-semibold text-muted hover:bg-surface-2"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleConfirmImport}
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Importation...
                    </>
                  ) : (
                    <>
                      Lancer l'importation ({parsedRows.length}) <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS */}
        {step === "SUCCESS" && importResult && (
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 rounded-full bg-surface-2 text-muted mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-medium text-ink">Importation Réussie !</h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
              <strong className="text-muted font-medium">{importResult.createdCount} prospect(s)</strong> ont été ajoutés avec succès.
              {importResult.duplicateCount > 0 && (
                <span> ({importResult.duplicateCount} doublon(s) déjà existants ignorés).</span>
              )}
            </p>

            <button
              onClick={onClose}
              className="mt-4 px-6 py-2.5 rounded-xl bg-accent text-white text-xs font-medium hover:bg-accent-hover"
            >
              Voir mes prospects
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
