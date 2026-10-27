"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUIContext } from "./contexts/UIContext";
import { Progress } from "@/components/ui/progress";
import { X, Upload, FileIcon } from "lucide-react";
import { Check } from "iconoir-react";
import { PrintDataLoadingErrors } from '@/app/helpers';
import { apiRoutes } from '@/app/api_routes';
import {useLocale, useTranslations} from 'next-intl';
import { t_richConfig } from '@/app/const_store';

const STATUS_POLL_INTERVAL_MS = 1000;
const STATUS_POLL_MAX_FAILURES = 5;
const STATUS_POLL_MAX_BACKOFF_MS = 5000;

/**
 * POST one file as multipart/form-data via XMLHttpRequest so the real
 * transfer progress can be observed (fetch() exposes no upload progress).
 * Resolves with the parsed JSON response, or null when the body is not
 * valid JSON (e.g. a proxy error page).
 */
function uploadFileWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("files", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";
    // No xhr.timeout: multi-GB uploads over slow connections may take hours.
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Number(((event.loaded / event.total) * 100).toFixed(1)));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 400) {
        let errDetail = `Server returned HTTP ${xhr.status} ${xhr.statusText || ""}`.trim();
        const resErr =
          xhr.response && typeof xhr.response === "object"
            ? xhr.response.error
            : undefined;
        if (resErr) {
          errDetail = String(resErr);
        }
        resolve({ error: errDetail });
      } else if (!xhr.response) {
        resolve({ error: `Server returned HTTP ${xhr.status} with empty/non-JSON response` });
      } else {
        resolve(xhr.response);
      }
    };
    xhr.onerror = () => resolve({ error: "Network connection lost or server unreachable during upload transfer" });
    xhr.onabort = () => resolve({ error: "Upload aborted by user" });
    xhr.send(formData);
  });
}

/**
 * Renders the multi-file ingestion workflow with transfer and backend-processing progress.
 *
 * @returns A localized drag-and-drop upload form with per-file status and error feedback.
 *
 * @remarks
 * XMLHttpRequest is intentionally used for byte-level upload progress. In demo mode, mutation attempts open the
 * restriction dialog instead of modifying the database.
 */
export default function FileUploadForm() {

  
  // Localization
  const t = useTranslations('page_upload');
  const { setIsDemoModeDialogOpen, demoMode } = useUIContext();

  const [files, setFiles] = useState<File[]>([]);
  const [curFile, setCurFile] = useState<string>("");
  const [processedFiles, setProcessedFiles] = useState<{
    [key: string]: string;
  }>({});
  const [collectErrors, setCollectErrors] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  // Real byte-level transfer progress (0–100) of the multipart POST,
  // reported by XHR upload events — fetch() cannot observe upload progress.
  const [transferProgress, setTransferProgress] = useState<number>(0);
  const [dbProgress, setDbProgress] = useState<number>(0);
  const [countryProgress, setCountryProgress] = useState<number>(0);
  // Transfer is measured in the browser; later phases come from the backend.
  const [phase, setPhase] = useState<"idle" | "transfer" | "db" | "country" | "complete">("idle");
  const [hasGeometry, setHasGeometry] = useState<boolean>(false);
  const [complete, setComplete] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  /** Backend upload result keyed by uploaded relation or status field. */
  interface UploadResponse {
    [key: string]: string;
  }

  const [uploadResponse, setuploadResponse] = useState<UploadResponse>();

  function checkedFiles_Type_Size_NameLength(file: File) {
    console.log("File: ", file);
    if (!file.name.endsWith(".csv")) {
      alert(`${file.name} is not a CSV file.`);
      return false;
    }
    // Must match proxyClientMaxBodySize in next.config.mjs — bigger files
    // would pass here and then be rejected by the proxy with a non-JSON error.
    if (file.size > 2500 * 1024 * 1024) {
      alert(`${file.name} exceeds the 2500MB size limit.`);
      return false;
    }
    if (file.name.length >= 70) {
      alert(`The name lenght of ${file.name} is to long. (limit >= 70 signs)`);
      return false;
    }
    return true;
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    let validFiles = acceptedFiles.filter(checkedFiles_Type_Size_NameLength);
    setFiles((previous) => [...previous, ...validFiles]);
    setComplete(false);
    setUploadProgress(0);
    setDbProgress(0);
    setCountryProgress(0);
    setHasGeometry(false);
    setProcessedFiles({});
    setCollectErrors([]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, disabled: isUploading });

  const removeFile = (file: File) => {
    setFiles((previous) => previous.filter((item) => item !== file));
  };



  const handleUpload = async () => {
    if (isUploading || files.length === 0) return;
    if (demoMode) {
      setIsDemoModeDialogOpen(true);
      return;
    }

    const queuedFiles = files;
    let uploadFailed = false;
    setIsUploading(true);
    setProcessedFiles({});
    setuploadResponse({});
    setCollectErrors([]);
    setComplete(false);
    setHasGeometry(false);
    setDbProgress(0);
    setCountryProgress(0);

    // Poll the combined status endpoint (one request per second) until the
    // backend reports completion (progress === 100) or an application error.
    // Short proxy/network interruptions are retried because processing keeps
    // running in the backend independently from this polling connection.
    async function watchProgress(uploadId: string) {
      let consecutiveFailures = 0;

      while (true) {
        let status: {
          progress: number;
          error: string;
          phase?: "db" | "country" | "complete";
          has_geometry?: boolean;
          db_progress?: number;
          country_progress?: number;
        };

        try {
          const response = await fetch(
            apiRoutes.uploadStatus({ id: uploadId }),
            { cache: "no-store" }
          );
          if (!response.ok) {
            throw new Error(`Upload status returned HTTP ${response.status}`);
          }

          status = await response.json();
          if (
            typeof status.progress !== "number" ||
            typeof status.error !== "string"
          ) {
            throw new Error("Upload status response is incomplete");
          }
          consecutiveFailures = 0;
        } catch (pollError) {
          consecutiveFailures += 1;
          console.warn(
            `Upload status request failed (${consecutiveFailures}/${STATUS_POLL_MAX_FAILURES})`,
            pollError
          );

          if (consecutiveFailures >= STATUS_POLL_MAX_FAILURES) {
            throw new Error(t("feedback.progressStatusUnavailable"));
          }

          const retryDelay = Math.min(
            STATUS_POLL_INTERVAL_MS * 2 ** (consecutiveFailures - 1),
            STATUS_POLL_MAX_BACKOFF_MS
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          continue;
        }

        if (typeof status.has_geometry === "boolean") {
          setHasGeometry(status.has_geometry);
        }
        if (status.phase) {
          setPhase(status.phase);
        }
        if (typeof status.db_progress === "number") {
          setDbProgress(Number(status.db_progress.toFixed(2)));
        }
        if (typeof status.country_progress === "number") {
          setCountryProgress(Number(status.country_progress.toFixed(2)));
        }

        if (status.error !== "false") {
          setuploadResponse({ error: (t("feedback.error") + ": " + status.error) });
          setCollectErrors((prev) => [...prev, status.error]);
          return false;
        }

        const progress = Number(status.progress.toFixed(2));
        console.log("Progress:", progress);
        setUploadProgress(progress);
        if (progress === 100) {
          setPhase("complete");
          return true;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, STATUS_POLL_INTERVAL_MS)
        );
      }
    }

    console.log("Files to upload:", queuedFiles);
    for (const file of queuedFiles) {
      setCurFile(file.name);
      // Transfer phase: XHR reports the real byte progress of the POST.
      // uploadProgress = 1 keeps the existing "busy" gating (disabled button,
      // visible progress area) until the DB phase takes over.
      setPhase("transfer");
      setHasGeometry(false);
      setTransferProgress(0);
      setDbProgress(0);
      setCountryProgress(0);
      setUploadProgress(1);
      try {
        const jsonResponse: any = await uploadFileWithProgress(
          apiRoutes.CREATE_TABLE_FROM_FILE,
          file,
          setTransferProgress
        );
        console.log("response: ", jsonResponse);

        const postError =
          jsonResponse && typeof jsonResponse === "object"
            ? jsonResponse["error"]
            : undefined;
        if (!jsonResponse || postError || !jsonResponse["upload_id"]) {
          const uploadError =
            postError || "Upload failed: no response from server";
          setuploadResponse({ error: (t("feedback.error") + ": " + uploadError) });
          setCollectErrors((prev) => [...prev, uploadError]);
          uploadFailed = true;
          break;
        }
        const resultMessage = jsonResponse["table_exist"] === true ? "updated" : "created";

        // Processing phase: poll until the backend has finished this upload
        setPhase("db");
        if (!await watchProgress(jsonResponse["upload_id"])) {
          uploadFailed = true;
          break;
        }
        setProcessedFiles((previous) => ({ ...previous, [file.name]: resultMessage }));
        console.log("File successfully uploaded:", file.name);
      } catch (uploadError) {
        console.error("Error uploading files:", uploadError);
        const errorDetail =
          uploadError instanceof Error
            ? uploadError.message
            : t("feedback.progressStatusUnavailable");
        const msg = `${file.name}: ${errorDetail}`;
        setuploadResponse({ error: (t("feedback.error") + ": " + msg) });
        setCollectErrors((prev) => [...prev, msg]);
        uploadFailed = true;
        break;
      }
    }

    if (!uploadFailed) {
      setuploadResponse({ SUCCESS: (t("feedback.success")) });
    }
    setFiles((previous) => previous.filter((file) => !queuedFiles.includes(file)));
    setCurFile("");
    setUploadProgress(0);
    setTransferProgress(0);
    setDbProgress(0);
    setCountryProgress(0);
    setPhase("idle");
    setComplete(true);
    setIsUploading(false);
  };
  return (
    <>
      <Card className="w-full max-w-md  ">
        <CardHeader>
          <CardTitle className="text-center text-2xl py-4 ">
            {/* Upload Files to Database: */}
            {t.rich("heading")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-4">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-primary bg-primary/10"
                : "border-gray-300 hover:border-primary"
            }`}
          >
            <input {...getInputProps()} />
            {isDragActive ? (
                 /* isDragActive: */
              <p>{t.rich("dropZoneIsDragActive")}</p>
            ) : (
              <p>
                 {/* dragZone: */}
                {t.rich("dropZone")} 
              </p>
            )}
          </div>
          {files.length > 0 && (
            <div className="space-y-2 ">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-gray-100 rounded"
                >
                  <div className="flex items-center space-x-2">
                    <FileIcon className="h-4 w-4" />
                    <span className="text-sm truncate max-w-xs hover:max-w-2xl">
                      {file.name}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    className="bg-indigo-600 hover:bg-indigo-500"
                    size="sm"
                    onClick={() => removeFile(file)}
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4 text-white" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {(complete || uploadProgress > 0) &&
            Object.keys(processedFiles).length !== 0 && (
              /* processed: */
              <div className="content-start text-slate-600">{t.rich("feedback.progressProcessed")}:</div>
            )}
          {(complete || uploadProgress > 0) &&
            Object.keys(processedFiles).map((fileName, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded bg-emerald-100"
                title={fileName}
              >
                <div className="flex items-center space-x-2">
                  <FileIcon className="h-4 w-4" />
                  <span className="text-sm truncate max-w-xs hover:max-w-2xl hover:pr-2">
                    {fileName}
                  </span>
                </div>
                <span className="text-sm">{processedFiles[fileName]}</span>
              </div>
            ))}
          {curFile != "" && (
            <div className="content-start truncate max-w-xl hover:max-w-3xl  text-slate-600">
                {/* working on...: */}
             {t.rich("feedback.progressWorkingOn")}: <i>{curFile}</i>
            </div>
          )}
          {(complete || uploadProgress > 0) && files.length !== 0 && (
            <div className="space-y-1">
              <div className="flex truncate max-w-xl items-center space-x-2">
                {t.rich("feedback.progressText")}
                {phase !== "transfer" ? <Check /> : <LoadingSpinner />}
              </div>
              <Progress
                value={phase === "transfer" ? transferProgress : 100}
                className="w-full"
              />
              <div className="text-center text-xs text-slate-600">
                {phase === "transfer" ? transferProgress : 100}%
              </div>
            </div>
          )}
          {(complete || phase === "db" || phase === "country" || phase === "complete") && files.length !== 0 && (
            <div className="space-y-1">
              <div className="flex truncate max-w-xl items-center space-x-2">
                {t.rich("feedback.progressDBIntegration")}
                {!complete && phase === "db" ? <LoadingSpinner /> : <Check />}
              </div>
              <Progress value={dbProgress} className="w-full" />
              <div className="text-center text-xs text-slate-600">
                {dbProgress}%
              </div>
            </div>
          )}
          {hasGeometry && (phase === "db" || phase === "country" || phase === "complete") && (
            <div className="space-y-1">
              <div className="flex truncate max-w-xl items-center space-x-2">
                {t.rich("feedback.progressCountryAssignment")}
                {phase === "country" && countryProgress < 100 ? (
                  <LoadingSpinner />
                ) : phase === "complete" || countryProgress === 100 ? (
                  <Check />
                ) : null}
              </div>
              <Progress value={countryProgress} className="w-full" />
              <div className="text-center text-xs text-slate-600">
                {countryProgress}%
              </div>
            </div>
          )}
          <Button
            onClick={handleUpload}
            className="w-full"
            disabled={files.length === 0 || isUploading}
          >
            <Upload className="mr-2 h-4 w-4" />
            {/* "Uploading..." : "Upload Files": */}
            {uploadProgress > 0 ? t.rich("feedback.progressText") : t.rich("ButtonUpload")}
          </Button>
          {complete && uploadResponse && files.length === 0 && (
            <div
              className={`text-center border-2 border-solid rounded-lg p-4 ${
                uploadResponse.error
                  ? "text-red-500 bg-red-100"
                  : "text-emerald-700 bg-emerald-100"
              }`}
            >
              {uploadResponse.error ? (
                <>{uploadResponse.error}</>
              ) : (
                <>
                  {uploadResponse.SUCCESS} 
                </>
              )}
            </div>
          )}
          <div className="h-1" />
          {collectErrors.length > 0 && (
            <PrintDataLoadingErrors
              listOfErrors={collectErrors}
              position="relative"
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}

/** Returns the compact loading indicator used by the upload workflow. */
function LoadingSpinner() {
  return (
    <>
      <div className="flex ">
        <div className="w-4 h-4 border-4 border-t-4  border-gray-200 rounded-full border-t-blue-500 animate-spin"></div>
      </div>
    </>
  );
}
