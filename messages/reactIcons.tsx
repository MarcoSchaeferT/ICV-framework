
'use client';

import { TbVirusSearch, TbChartInfographic } from 'react-icons/tb';
import { MdOutlineDataset, MdOutlineLocationOn } from "react-icons/md";
import { FaMosquito, FaGithub } from "react-icons/fa6";
import { GrCubes, GrDocumentTest } from "react-icons/gr";
import { GiGreekTemple, GiAntibody } from "react-icons/gi";
import { CgFileDocument } from "react-icons/cg";
import { FiGlobe } from "react-icons/fi";

/**
 * Virus search icon for disease-related navigation.
 *
 * @default size `24` pixels.
 */
const VirusIcon = ({ size = 24 }: { size?: number }) => <TbVirusSearch size={size} />;
/**
 * Dataset icon for analytical data links.
 *
 * @default size `24` pixels.
 */
const LineDataThresholdingIconn = ({ size = 24 }: { size?: number }) => <MdOutlineDataset size={size} />;
/**
 * Mosquito icon for vector-related navigation.
 *
 * @default size `24` pixels.
 */
const MosquitoIcon = ({ size = 24 }: { size?: number }) => <FaMosquito size={size} />;
/**
 * Cube icon for modular dashboard content.
 *
 * @default size `24` pixels.
 */
const CubesIcon = ({ size = 24 }: { size?: number }) => <GrCubes size={size} />;
/**
 * Infographic icon for information links.
 *
 * @default size `24` pixels.
 */
const InfoIcon = ({ size = 24 }: { size?: number }) => <TbChartInfographic size={size} />;
/**
 * Institution icon for organization links.
 *
 * @default size `24` pixels.
 */
const GreekTemple = ({ size = 24 }: { size?: number }) => <GiGreekTemple size={size} />;
/**
 * Globe icon for world-view navigation.
 *
 * @default size `24` pixels.
 */
const Globe = ({ size = 24 }: { size?: number }) => <FiGlobe size={size} />;
/**
 * Document icon for publications and reference links.
 *
 * @default size `24` pixels.
 */
const DocumentIcon = ({ size = 24 }: { size?: number }) => <CgFileDocument size={size} />;
/**
 * GitHub icon for repository links.
 *
 * @default size `24` pixels.
 */
const GitHubIcon = ({ size = 24 }: { size?: number }) => <FaGithub size={size} />;
/**
 * Antibody icon for immune-response content.
 *
 * @default size `24` pixels.
 */
const AntibodyIcon = ({ size = 24 }: { size?: number }) => <GiAntibody size={size} />;
/**
 * Location marker icon for geographic content.
 *
 * @default size `24` pixels.
 */
const LocationIcon = ({ size = 24 }: { size?: number }) => <MdOutlineLocationOn size={size} />;
/**
 * Test-document icon for report content.
 *
 * @default size `22` pixels.
 */
const DocumentTestIcon = ({ size = 22 }: { size?: number }) => <GrDocumentTest size={size} />;


export  {
  VirusIcon,
  LineDataThresholdingIconn,
  MosquitoIcon,
  CubesIcon,
  InfoIcon,
  GreekTemple,
  Globe,
  DocumentIcon,
  GitHubIcon,
  AntibodyIcon,
  LocationIcon,
  DocumentTestIcon
};
