
'use client';

import { TbVirusSearch } from 'react-icons/tb';
import { MdOutlineDataset } from "react-icons/md";
import { FaMosquito } from "react-icons/fa6";
import { GrCubes } from "react-icons/gr";
import { TbChartInfographic } from "react-icons/tb";
import { GiGreekTemple } from "react-icons/gi";
import { CgFileDocument } from "react-icons/cg";
import { FaGithub } from "react-icons/fa6";
import { GiAntibody } from "react-icons/gi";
import { MdOutlineLocationOn } from "react-icons/md";
import { GrDocumentTest } from "react-icons/gr";

const VirusIcon = ({ size = 24 }: { size?: number }) => <TbVirusSearch size={size} />;
const LineDataThresholdingIconn = ({ size = 24 }: { size?: number }) => <MdOutlineDataset size={size} />;
const MosquitoIcon = ({ size = 24 }: { size?: number }) => <FaMosquito size={size} />;
const CubesIcon = ({ size = 24 }: { size?: number }) => <GrCubes size={size} />;
const InfoIcon = ({ size = 24 }: { size?: number }) => <TbChartInfographic size={size} />;
const GreekTemple = ({ size = 24 }: { size?: number }) => <GiGreekTemple size={size} />;
const DocumentIcon = ({ size = 24 }: { size?: number }) => <CgFileDocument size={size} />;
const GitHubIcon = ({ size = 24 }: { size?: number }) => <FaGithub size={size} />;
const AntibodyIcon = ({ size = 24 }: { size?: number }) => <GiAntibody size={size} />;
const LocationIcon = ({ size = 24 }: { size?: number }) => <MdOutlineLocationOn size={size} />;
const DocumentTestIcon = ({ size = 22 }: { size?: number }) => <GrDocumentTest size={size} />;


export  {
  VirusIcon,
  LineDataThresholdingIconn,
  MosquitoIcon,
  CubesIcon,
  InfoIcon,
  GreekTemple,
  DocumentIcon,
  GitHubIcon,
  AntibodyIcon,
  LocationIcon,
  DocumentTestIcon
};