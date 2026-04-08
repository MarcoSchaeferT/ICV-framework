interface PublicationI {
  id: string
  title: string
  authors: string[]
  date: string
  type: 'conference' | 'journal' | 'preprint' | 'workshop'
  conference?: string
  journal?: string
  doi?: string
  url?: string
  abstract: string
  tags: string[]
}



const PUBLICATIONS_LIST: PublicationI[] = [
  {
    id: '1',
    title: 'Holistic Forecasting for Future Pandemics: A Review of Pathogens, Models, and Data',
    authors: [
      'Luis Roger Esquivel Gomez',
      'Nadezdha Malysheva',
      'Juliane Pfeil',
      'Zewen Yang',
      'Sandra M. Bütow',
      'Christopher Irrgang',
      'Nils Körber',
      'Georges Hattab',
      'Denise Kühnert',
      'Katharina Ladewig',
    ],
    date: '2025-04-30',
    type: 'journal',
    journal: 'Discover Public Health',
    doi: '10.1186/s12982-025-00573-y',
    url: 'https://doi.org/10.1186/s12982-025-00573-y',
    abstract:
      'Pandemics challenge the capacity and resilience of healthcare systems around the world. A rapid and effective response to the sudden spread of a pathogen is therefore key to minimising the burden of a disease. Epidemic forecasting generates possible future scenarios of disease spread that can inform the decision-making process of public health authorities, leading to the timely implementation of efficient control strategies. Here, we provide an overview of the pathogens that possess the potential to cause future pandemics, the different models, and the data sources that can be employed to generate prognoses about their spread. Existing efforts focus mainly on one or two different sources, failing to account for multiple factors that influence disease transmission. We discuss recent developments that can lead us towards a holistic forecasting system capable of integrating different data sources, which, we argue, is needed to make reliable predictions and ensure a timely response by public health authorities at a global scale.',
    tags: ['Disease forecasting', 'Pandemic preparedness', 'Pandemics', 'Pathogen surveillance', 'Public health'],
  },
  {
    id: '2',
    title: 'Climate-driven future habitat prediction of arbovirus vectors Aedes aegypti and Aedes albopictus',
    authors: ['Tarique Adnan Adnan Siddiqui', 'Nadezhda Malysheva', 'Anna-Maria Hartner', 'Christopher Irrgang'],
    date: '2024-12-01',
    type: 'conference',
    conference: 'AGU Fall Meeting 2024 (Session GH52B-01)',
    url: 'https://ui.adsabs.harvard.edu/abs/2024AGUFMGH52B..01S',
    abstract:
      'As mosquito-borne diseases such as dengue and chikungunya continuously expand their geographical range, they are increasingly becoming global health problems. Aedes aegypti and Aedes albopictus are two mosquito species that are known vectors of transmitting dengue and chikungunya viruses. Mapping the global distribution of these mosquito species and determining their suitable environmental conditions is therefore an important step in identifying the geographical regions that are at risk of becoming their future habitats. In this study, we make use of a published database cataloguing the presence of both these mosquito species and combine it with relevant environmental variables to predict their future habitats. For this purpose, we employ a machine learning based approach using Support Vector Machines (SVM) to develop a model that broadly reproduces the current known geographical habitats of Ae. aegypti and Ae. albopictus. Our method works without the need of artificially creating pseudo-absence data of these mosquito species and relies solely on their presence data. We further employ CMIP6 downscaled climate projections to assess the future global distributions of these two species for different shared socioeconomic pathway (SSP) climate scenarios.',
    tags: ['Climate change', 'Vector-borne diseases', 'Habitat modeling'],
  },
];

export default PUBLICATIONS_LIST;
export type { PublicationI };