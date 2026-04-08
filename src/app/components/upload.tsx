"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { X, Upload, FileIcon } from "lucide-react";
import { Check } from "iconoir-react";
import { PrintDataLoadingERRORs } from "../helpers";
import { apiRoutes } from "../api_routes";
import {useLocale, useTranslations} from 'next-intl';
import { t_richConfig } from '../const_store';

export default function FileUploadForm() {

  
  // Localization
  const t = useTranslations('page_upload');

  const files = useRef<File[]>([]);
  const [curFile, setCurFile] = useState<string>("");
  const [prevFile, setPrevFile] = useState<string>("");
  const processedFilesRef = useRef<{
    [key: string]: string;
  }>({});
  const [collectEROORS, setCollectEROORS] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUpdate, setIsUpdate] = useState<boolean>(false);
  const watchProgressRunning = useRef<boolean>(false);

  let message = useRef<string>("created");
  let data: { progress: number } = { progress: 1 };
  let complete = useRef<boolean>(
    files.current.length === 0 && (data.progress === 0 || data.progress === 100)
  );
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
    if (file.size > 3000 * 1024 * 1024) {
      alert(`${file.name} exceeds the 3000MB size limit.`);
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
    try {
      fetch(apiRoutes.setUploadProgress({ progressVal: 0 }), {
        method: "GET",
      });
    } catch (e) {
      console.error(e);
    }
    try {
      fetch(apiRoutes.GET_UPLOAD_ERROR, {
        method: "GET",
      });
    } catch (e) {
      console.error(e);
    }
    setCollectEROORS([]);
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
  

  let jsonResponse: any = null;

  const handleUpload = async () => {
    
    processedFilesRef.current = {};
    setuploadResponse({});
    
    async function watchProgress() {

      if (watchProgressRunning.current) return;
      watchProgressRunning.current = true;
      
      try {
        complete.current = false;
        error.current = false;

        while (!complete.current && !error.current) {
          const response = await fetch(apiRoutes.GET_UPLOAD_PROGRESS, {
            method: "POST",
          });
          const errorResponse = await fetch(apiRoutes.GET_UPLOAD_ERROR, {
            method: "POST",
          });
        
          const errorData = await errorResponse.json();
          if (errorData["ERROR"] !== "false") {
            setuploadResponse({ ERROR: (t("feedback.error") + ": " + errorData["ERROR"]) });
            console.log("Progress:", errorData["ERROR"]);
            setCollectEROORS((prev) => [...prev, errorData["ERROR"]]);
            error.current = true;
          
          }
          data = await response.json();
          data.progress =
            Math.ceil(data.progress) == -1 ? 1 : (data.progress.toFixed(2) as unknown as number);
          console.log("Progress:", data.progress);
          setUploadProgress(data.progress);

          await new Promise((resolve) => setTimeout(resolve, 1000));
          if (data.progress === 100) {
            //console.log("-----:", Math.ceil(data.progress), files[files.length-1].name, "===", curFile, "complete", complete, processedFiles);
            complete.current = true;
          }
        }
        setuploadResponse(() => {
          console.log("SETTING: Files successfully uploaded");
          return { SUCCESS: (t("feedback.success")) };
        });
        //files.current = [];
        setCurFile("");
      // setUploadProgress(0);
        await fetch(apiRoutes.setUploadProgress({ progressVal: 1 }), {
          method: "GET",
        });
      }
      catch (error) {
        console.error("Error watching progress:", error);
      } finally {
        watchProgressRunning.current = false;
      }
    }




    // Here you would typically send the files to your server
    console.log("Files to upload:", files);
    await fetch(apiRoutes.setUploadProgress({ progressVal: 1 }), {
      method: "GET",
    });
   
    for (const file of files.current) {
      await fetch(apiRoutes.setUploadProgress({ progressVal: 1 }), {
        method: "GET",
      });
      setUploadProgress(1);
      data.progress = 1;
      setCurFile(file.name);
      watchProgress();
      try {
        const formData = new FormData();
        formData.append("files", file);
        if(data.progress > 1)  return;

        const response2 = await fetch(apiRoutes.CREATE_TABLE_FROM_FILE, {
          method: "POST",
          body: formData,
        });

          try {
            jsonResponse = await response2.json();
          } catch (error) {
            jsonResponse = null;
          }

          message.current = (jsonResponse["table_exist"] === true) ? "updated" : "created";
          console.log("response: ", jsonResponse);

        // check if the response contains an error message
        if (
          jsonResponse &&
          jsonResponse["ERROR"]
        ) {
          setCollectEROORS((prev) => [...prev, jsonResponse["ERROR"]]);
        }
        console.log("ERROR: ", collectEROORS);


        while (data.progress < 100) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        console.log("Files successfully uploaded");
      } catch (error) {
        console.error("Error uploading files:", error);
      }
    }
    files.current = [];
    setCurFile("");
    setUploadProgress(0);
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
                    size="sm"
                    onClick={() => {
                      removeFile(file)
                      setIsUpdate(!isUpdate)
                    }}
                  >
                    <X className="h-4 w-4" />
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
                <Progress value={uploadProgress} className="w-full" />
                <div className="text-center text-xs text-slate-600">{uploadProgress}%</div>
              </>
            )}
          {(complete.current || uploadProgress > 0) && files.current.length !== 0 && (
            <div className="flex truncate max-w-xl items-center space-x-2">
              {/* uploading...: */}
              {t.rich("feedback.progressText")}
              {uploadProgress >= 0 && uploadProgress != 1 ? (
                <Check />
              ) : (
                <LoadingSpinner />
              )}
            </div>
          )}
          {(complete.current || uploadProgress > 1) && files.current.length !== 0 && (
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
          {collectEROORS.length > 0 && (
            <PrintDataLoadingERRORs
              listOfERRORs={collectEROORS}
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
