"use client";
import Image from "next/image"
import { Link } from "@/i18n/routing"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bug, Lightbulb, ExternalLink, InfoIcon } from 'lucide-react'
import {GitHubIcon} from "../../../../messages/reactIcons"
import {useRef, useEffect, useState } from "react"

import {useLocale, useTranslations} from 'next-intl';
import { t_richConfig, layoutSizes } from '../../const_store';
import {Locale } from '@/i18n/routing';
import { apiRoutes } from "@/app/api_routes";
import validator from "validator";
import { Progress } from "@/components/ui/progress"
import {MdxLayoutAbout} from '@/mdx-layout'
import {MDXContentProvider} from '../../../../messages/markdown/MDXContentProvider'


export default function Component() {

  // States
  const [contactType, setContactType] = useState("feature");
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [isUpdate, setIsUpdate] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [response, setResponse] = useState<string>("");
  const [isValidObj, setIsValidObj] = useState<{ [key: string]: boolean }>({});
  const [isError, setIsError] = useState<boolean>(false);

  // Localization
  const t_main = useTranslations('page_about.main');
  const t_feedback = useTranslations('page_about.FeedbackForm');
  const t = useTranslations("page_home.pageContent");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState(13);

  const locale = useLocale() as Locale;
  const MDXContent = MDXContentProvider[locale].pages.About.projectInfo;

  useEffect(() => {
    if (isHighlighted && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isHighlighted,contactType]);


  function scrollToFeedbackForm() {
    const mapElem = document.getElementById('map1-scroll-anchor');
    if (mapElem) {
      const y = mapElem.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
   e.preventDefault();
      // Handle form submission
      const formData = new FormData();
      const nameElem = nameRef.current;
      const emailElem = emailRef.current;
      const textareaElem = textareaRef.current;
      const newIsValidObj = { ...isValidObj };

      // Validate 
      newIsValidObj.email = emailElem && emailElem.value.length > 0 ? validator.isEmail(emailElem.value) : true;
      newIsValidObj.name = nameElem && nameElem?.value.length > 0 ? validator.isLength(nameElem.value, { min: 3, max: 30 }) : true;
      newIsValidObj.message = textareaElem ? validator.isLength(textareaElem.value, { min: 10, max: 1500 }) : true;
      setIsValidObj(newIsValidObj);


      if (newIsValidObj.email && newIsValidObj.name && newIsValidObj.message) {

        formData.append("name", nameElem ? nameElem.value : "");
        formData.append("email", emailElem ? emailElem.value : "");
        formData.append("feedback_type", contactType);
        formData.append("message", textareaElem ? textareaElem.value : "");
        formData.append("relationName", "feedback_csv");

        fetch(apiRoutes.SET_ENTRY_TO_TABLE, {
          method: "POST",
          body: formData,
        })
          .then((response) => response.json())
          .then((data) => {
            console.log("Success:", data);
            if (data.SUCCESS) {
              // Handle success case
              if (nameElem) nameElem.value = "";
              if (emailElem) emailElem.value = "";
              if (textareaRef.current) textareaRef.current.value = "";
              setContactType("feature");
              setIsHighlighted(false);
              setIsSuccess(true);
              setResponse(data.SUCCESS.toString());
             
            }
          })
          .catch((error) => {
            console.error("Error:", error);
          });
          setIsError(false);

      } else {
        setIsError(true);
        setIsSuccess(true);
        setIsUpdate(prev => !prev);
      }
    }

    useEffect(() => {
      const time = 5000; // 5 seconds
      const steps = 10; // ms
      if (!isSuccess) return;
     setTimeout(() => {
          setIsSuccess(false);
        }, time);

        for (let i = 0; i <= time; i+=steps){
          setTimeout(() => {
            setProgress(i/time*100);
          }, i);
        }
      
    }, [isSuccess]);

  return (
    <div className="min-h-screen ">
      
      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
      
          
        <div className="max-w-6xl mx-auto">
           
           {/*} <div className="relative z-50 top-64 left-21/100 bg-blue-500 w-12 h-12 rounded-full border-4 border-background flex items-center justify-center">
                  <InfoIcon className="w-6 h-6 text-white" />
                </div>*/}
         
            {/* Project Image/Logo */}
            <div className="flex flex-col lg:flex-row items-center gap-8">
              {/* Project Image/Logo */}
              <div className="shrink-0 ml-6">
                <Image
                  src="/iconHighDetail.svg?height=500&width=500"
                  alt="ICV Icon"
                  width={310}
                  height={260}
                  className="rounded-2xl"
                />
              </div>
              {/* Project Info */}
              <div className="flex-1 space-y-6 pr-1">
                 <div className="flex items-end justify-between gap-3  ">
              <h1 className="text-3xl font-extrabold"> {t_main.rich('Heading',{...t_richConfig,})}</h1>
            </div>
                <div>
                  <MdxLayoutAbout>
                    <MDXContent />
                  </MdxLayoutAbout>
                  <p className="text-xl text-muted-foreground mb-6">
                    {t_main.rich('projectInfo', { ...t_richConfig })}
                  </p>
                </div>
        
          
      
              {/* GitHub Links */}
           <div className="flex flex-wrap gap-3 items-end justify-between">
              <div className="flex flex-wrap gap-3 ">
                <Button asChild >
                  <Link href="https://github.com/MarcoSchaeferT/ICV-framework" className="flex items-center gap-2">
                    <GitHubIcon  />
                   {t_main.rich('ButtonGitHub',{...t_richConfig,})}
                  </Link>
                </Button>
                <Button variant="outline" asChild onClick={() => {
                   setContactType("feature");
                   scrollToFeedbackForm();
                   setIsHighlighted(true); }}>
                  <div>
                    <Lightbulb className="w-4 h-4" />
                    <div className="pl-1 cursor-pointer">{t_main.rich('ButtonFeature',{...t_richConfig,})}</div>
                  </div>
                </Button>
                <Button variant="outline" asChild onClick={() => {
                   setContactType("bug");
                    scrollToFeedbackForm();
                     setIsHighlighted(true); }}>
                 <div>
                   <Bug className="w-4 h-4" />
                  <div
                    className="pl-1 cursor-pointer "
                  >
                    {t_main.rich('ButtonBug', { ...t_richConfig })}
                  </div>
                 </div>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="https://github.com/MarcoSchaeferT/ICV-framework/packages" className="flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    {t_main.rich('ButtonReleases',{...t_richConfig,})}
                  </Link>
                </Button>
                </div>
                 <div className="min-w-fit flex flex-row items-center gap-2">
                  <Badge variant="secondary">v0.9.5</Badge>
                  {/*<Badge className="bg-green-100 text-green-800">Active</Badge>*/}
                  </div>
              </div>
            </div>
          </div>

            {/* Anchor for scrolling */}
                  <div id="map1-scroll-anchor" style={{ paddingTop: layoutSizes.topNavbarHeight }} />

          {/* About the Project 
          <div className="prose prose-gray dark:prose-invert max-w-none mb-12">
            <h2 className="text-3xl font-bold mb-6">About ICV</h2>
            <p className="text-lg leading-relaxed mb-6">
              lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. iusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim venia
            </p>
            <p className="text-lg leading-relaxed mb-6">
             Solore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. viusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim venia
            </p>
          </div>*/}

         

          {/* Feedback Form 
          <div className="text-md text-error-dark">(Work in progress: currently not working)</div>*/}
          <Card className="bg-white shadow-lg rounded-lg ml-7">

            <CardHeader>
              <CardTitle> {t_feedback.rich('heading',{...t_richConfig,})}</CardTitle>
              <p className="text-muted-foreground">
                 {t_feedback.rich('subHeading',{...t_richConfig,})}
              </p>
            </CardHeader>
            <CardContent>
              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name"> {t_feedback.rich('InputName',{...t_richConfig,})}
                       <p className="text-xs text-gray-400 text-muted-foreground">
                      (optional)
                    </p>
                    </Label>
                    <Input id="name" ref={nameRef} placeholder={t_feedback('InputNamePlaceholder')} onChange={() => setIsValidObj(prev => ({...prev, name: true}))} />
                     {isValidObj.name === false && <p className="text-red-600 text-xs">{t_feedback.rich('InputNameError',{...t_richConfig,})}</p>}
                  </div>
                  <div className="space-y-2">
                   <Label htmlFor="email"> {t_feedback.rich('InputEmail',{...t_richConfig,})}
                    <p className="text-xs text-gray-400 text-muted-foreground">
                      (optional)
                    </p>
                  </Label>
                    <Input id="email" ref={emailRef} type="test" placeholder={t_feedback('InputEmailPlaceholder')} onChange={() => setIsValidObj(prev => ({...prev, email: true}))} />
                     {isValidObj.email === false && <p className="text-red-600 text-xs">{t_feedback.rich('InputEmailError',{...t_richConfig,})}</p>}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="feedback-type">{t_feedback.rich('FeedbackType',{...t_richConfig,})}</Label>
                  <Select  value={contactType} onValueChange={() => {setContactType; setIsHighlighted(false);}}>
                    <SelectTrigger >
                      <SelectValue placeholder="Select feedback type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feature">{t_feedback.rich('FeedbackTypes.feature',{...t_richConfig,})}</SelectItem>
                      <SelectItem value="bug">{t_feedback.rich('FeedbackTypes.bug',{...t_richConfig,})}</SelectItem>
                      <SelectItem value="improvement">{t_feedback.rich('FeedbackTypes.improvement',{...t_richConfig,})}</SelectItem>
                      <SelectItem value="general">{t_feedback.rich('FeedbackTypes.general',{...t_richConfig,})}</SelectItem>
                      <SelectItem value="question">{t_feedback.rich('FeedbackTypes.question',{...t_richConfig,})}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="message">{t_feedback.rich('InputMessage',{...t_richConfig,})}</Label>
                  <Textarea 
                  id="message" 
                  placeholder={t_feedback('InputMessagePlaceholder')}
                  className="min-h-[120px]"
                  onChange={() => setIsValidObj(prev => ({...prev, message: true}))}
                  ref={textareaRef}
                  />
                   {isValidObj.message === false && <p className="text-red-600 text-xs">{t_feedback.rich('InputMessageError',{...t_richConfig,})}</p>}
                </div>
                
                <div className="flex items-center gap-4">
                  <Button type="submit" className="flex-1 md:flex-none">
                   {t_feedback.rich('ButtonSend',{...t_richConfig,})}
                  </Button>
                  {!isSuccess && (

                    <p className="text-xs text-muted-foreground">
                      {t_feedback.rich('ButtonSideText',{...t_richConfig,})}
                    </p>)}
                   {isSuccess && <FeedbackSuccess text={response} isAlert={ isError} progress={progress} />}
                </div>
              </form>
          
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}



function FeedbackSuccess({ text,isAlert, progress }: { text: string, isAlert: boolean, progress?: number }) {
  const t_feedback = useTranslations('page_about.FeedbackForm');
    return (
      <div className={`relative z-50 ${isAlert ? 'bg-red-50 border-red-300 text-red-900' : 'bg-green-50 border-green-300 text-green-900'} px-4 py-3 rounded-md shadow flex items-center gap-2 animate-fade-in`}>
           {isAlert ? (
        <>
           <span className="text-lg text-red-600" aria-label="error" role="img">❌</span>
          <div>
          <div className="font-semibold">{t_feedback.rich('FeedbackDialog.alert.title',{...t_richConfig,})}</div>
          <div className="text-sm mt-1">{t_feedback.rich('FeedbackDialog.alert.description',{...t_richConfig,})}</div>
        <Progress className="mt-1 text-xs" style={{ width: `${100-(progress ?? 0)}%` }} />
          </div>
        </>
          ) : (
        <>
           <span role="img" aria-label="thank you" className="text-lg">🎉</span>
          <div>
            <div className="font-semibold">{t_feedback.rich('FeedbackDialog.success.title',{...t_richConfig,})}</div>
            <div className="text-sm mt-1">{t_feedback.rich('FeedbackDialog.success.description',{...t_richConfig,})}</div>
           <Progress className="mt-1 text-xs" style={{ width: `${100-(progress ?? 0)}%` }} />
          </div>
        </>
          )}
         
      </div>
    );

}
