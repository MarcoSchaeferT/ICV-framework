"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload aborted"));
    xhr.send(formData);
  });
}

export default function FileUploadForm() {

  
  // Localization
  const t = useTranslations('page_upload');
  const { setIsDemoModeDialogOpen, demoMode } = useUIContext();

  const files = useRef<File[]>([]);
  const [curFile, setCurFile] = useState<string>("");
  const [prevFile, setPrevFile] = useState<string>("");
  const processedFilesRef = useRef<{
    [key: string]: string;
  }>({});
  const [collectErrors, setCollectErrors] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  // Real byte-level transfer progress (0–100) of the multipart POST,
  // reported by XHR upload events — fetch() cannot observe upload progress.
  const [transferProgress, setTransferProgress] = useState<number>(0);
  // "transfer" = bytes still leaving the browser, "db" = backend integration
  const [phase, setPhase] = useState<"idle" | "transfer" | "db">("idle");
  const [isUpdate, setIsUpdate] = useState<boolean>(false);

  let message = useRef<string>("created");
  let complete = useRef<boolean>(false);
  let error =  useRef<boolean>(false);

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
    files.current = [...files.current, ...validFiles];
    complete.current = false;
    setUploadProgress(0);
    processedFilesRef.current = {};
    setCollectErrors([]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const removeFile = (file: File) => {
    files.current = files.current.filter((f) => f !== file);
  };



  useEffect(() => {
    localStorage.setItem("pendingUploads", JSON.stringify(files));
  }, [files]);
  
  useEffect(() => {
    const savedFiles = JSON.parse(localStorage.getItem("pendingUploads") || "[]");
    if (savedFiles.length > 0) {
      files.current = savedFiles;
      handleUpload();
    }
  }, []);
  

  const handleUpload = async () => {
    if (demoMode) {
      setIsDemoModeDialogOpen(true);
      return;
    }

    processedFilesRef.current = {};
    setuploadResponse({});
    setCollectErrors([]);
    complete.current = false;
    error.current = false;

    // Poll the combined status endpoint (one request per second) until the
    // backend reports completion (progress === 100) or an error.
    async function watchProgress(uploadId: string) {
      while (true) {
        const response = await fetch(apiRoutes.uploadStatus({ id: uploadId }));
        const status: { progress: number; error: string } = await response.json();

        if (status.error !== "false") {
          setuploadResponse({ ERROR: (t("feedback.error") + ": " + status.error) });
          setCollectErrors((prev) => [...prev, status.error]);
          error.current = true;
          return;
        }

        const progress = Number(status.progress.toFixed(2));
        console.log("Progress:", progress);
        setUploadProgress(progress);
        if (progress === 100) return;

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log("Files to upload:", files);
    for (const file of files.current) {
      setCurFile(file.name);
      // Transfer phase: XHR reports the real byte progress of the POST.
      // uploadProgress = 1 keeps the existing "busy" gating (disabled button,
      // visible progress area) until the DB phase takes over.
      setPhase("transfer");
      setTransferProgress(0);
      setUploadProgress(1);
      try {
        const jsonResponse: any = await uploadFileWithProgress(
          apiRoutes.CREATE_TABLE_FROM_FILE,
          file,
          setTransferProgress
        );
        console.log("response: ", jsonResponse);

        if (!jsonResponse || jsonResponse["ERROR"] || !jsonResponse["upload_id"]) {
          const uploadError =
            (jsonResponse && jsonResponse["ERROR"]) || "Upload failed: no response from server";
          setuploadResponse({ ERROR: (t("feedback.error") + ": " + uploadError) });
          setCollectErrors((prev) => [...prev, uploadError]);
          error.current = true;
          break;
        }
        message.current = (jsonResponse["table_exist"] === true) ? "updated" : "created";

        // Processing phase: poll until the backend has finished this upload
        setPhase("db");
        await watchProgress(jsonResponse["upload_id"]);
        if (error.current) break;
        console.log("File successfully uploaded:", file.name);
      } catch (uploadError) {
        console.error("Error uploading files:", uploadError);
        const msg = `${file.name}: connection lost during transfer`;
        setuploadResponse({ ERROR: (t("feedback.error") + ": " + msg) });
        setCollectErrors((prev) => [...prev, msg]);
        error.current = true;
        break;
      }
    }

    if (!error.current) {
      setuploadResponse({ SUCCESS: (t("feedback.success")) });
    }
    files.current = [];
    setCurFile("");
    setUploadProgress(0);
    setTransferProgress(0);
    setPhase("idle");
    complete.current = true;
  };
  //let complete: boolean = (files.length === 0 && uploadResponse !== undefined && (typeof uploadResponse["ERROR"] === 'string' || typeof uploadResponse["SUCCESS"] === 'string'));
  useEffect(() => {
    console.log("Setting processedFiles: ", curFile, message.current, prevFile);
    if (prevFile != "") {
      console.log("processedFilesREAL: ", prevFile, message.current);
      processedFilesRef.current[prevFile] = message.current;
      const fileToRemove = files.current.find((file) => file.name === prevFile);
      if (fileToRemove) {
        // removeFile(fileToRemove);
      }
    }
    setPrevFile(curFile);
  }, [curFile]);

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
          {files.current.length > 0 && (
            <div className="space-y-2 ">
              {files.current.map((file, index) => (
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
                    onClick={() => {
                      removeFile(file)
                      setIsUpdate(!isUpdate)
                    }}
                  >
                    <X className="h-4 w-4 text-white" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {Object.keys(processedFilesRef.current).length > 0 && (
            <div className="text-center  text-slate-600"></div>
          )}
          {(complete.current || uploadProgress > 0) &&
            Object.keys(processedFilesRef.current).length !== 0 && (
              /* processed: */
              <div className="content-start text-slate-600">{t.rich("feedback.progressProcessed")}:</div>
            )}
          {(complete.current || uploadProgress > 0) &&
            Object.keys(processedFilesRef.current).map((fileName, index) => (
              <div
                key={index}
                className={`flex items-center justify-between rounded ${
                  error.current ? "bg-red-100" : "bg-emerald-100"
                }`}
                title={fileName}
              >
                <div className="flex items-center space-x-2">
                  <FileIcon className="h-4 w-4" />
                  <span className="text-sm truncate max-w-xs hover:max-w-2xl hover:pr-2">
                    {fileName}
                  </span>
                </div>
                <span className="text-sm">{processedFilesRef.current[fileName]}</span>
              </div>
            ))}
          {curFile != "" && (
            <div className="content-start truncate max-w-xl hover:max-w-3xl  text-slate-600">
                {/* working on...: */}
             {t.rich("feedback.progressWorkingOn")}: <i>{curFile}</i>
            </div>
          )}
            {uploadProgress > 0 && (
              <>
                {/* transfer phase: real bytes sent; db phase: backend progress */}
                <Progress
                  value={phase === "transfer" ? transferProgress : uploadProgress}
                  className="w-full"
                />
                <div className="text-center text-xs text-slate-600">
                  {phase === "transfer" ? transferProgress : uploadProgress}%
                </div>
              </>
            )}
          {(complete.current || uploadProgress > 0) && files.current.length !== 0 && (
            <div className="flex truncate max-w-xl items-center space-x-2">
              {/* uploading...: */}
              {t.rich("feedback.progressText")}
              {phase !== "transfer" ? (
                <Check />
              ) : (
                <LoadingSpinner />
              )}
            </div>
          )}
          {(complete.current || phase === "db") && files.current.length !== 0 && (
            <div className="flex truncate max-w-xl items-center space-x-2">
               {/* db integration...: */}
              {t.rich("feedback.progressDBIntegration")}
              {!complete.current && uploadProgress < 99 ? (
                <LoadingSpinner />
              ) : (
                <Check />
              )}
            </div>
          )}
          <Button
            onClick={handleUpload}
            className="w-full"
            disabled={files.current.length === 0 || uploadProgress > 0}
          >
            <Upload className="mr-2 h-4 w-4" />
            {/* "Uploading..." : "Upload Files": */}
            {uploadProgress > 0 ? t.rich("feedback.progressText") : t.rich("ButtonUpload")}
          </Button>
          {complete.current && uploadResponse && files.current.length === 0 && (
            <div
              className={`text-center border-2 border-solid rounded-lg p-4 ${
                uploadResponse.ERROR
                  ? "text-red-500 bg-red-100"
                  : "text-emerald-700 bg-emerald-100"
              }`}
            >
              {uploadResponse.ERROR ? (
                <>{uploadResponse.ERROR}</>
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

function LoadingSpinner() {
  return (
    <>
      <div className="flex ">
        <div className="w-4 h-4 border-4 border-t-4  border-gray-200 rounded-full border-t-blue-500 animate-spin"></div>
      </div>
    </>
  );
}
