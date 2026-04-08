import { apiRoutes } from '../src/app/api_routes';

const blogDiseases = {
        "en": [
        {
        title: "Dengue-Virus",
        column_2: "A. albopictus, A. aegypti",
        content: `<ul style="list-style-type:disc;">
                    <li>Dengue is a viral infection transmitted to humans through the bite of infected mosquitoes.</li>
                    <li>About half of the world's population is now at risk of dengue with an estimated 100–400 million infections occurring each year.</li>
                    <li>Dengue is found in tropical and sub-tropical climates worldwide, mostly in urban and semi-urban areas.</li>
                    <li>While many dengue infections are asymptomatic or produce only mild illness, the virus can occasionally cause more severe cases, and even death.</li>
                    <li>Prevention and control of dengue depend on vector control. There is no specific treatment for dengue/severe dengue, and early detection and access to proper medical care greatly lower fatality rates of severe dengue.</li>
                    </ul>`,
        imageUrl: "/viruses/Dengue_Virus.png",
        imageCaption: "Dengue Virus - 3D Structure",
        sourceURL: "https://www.rcsb.org/3d-view/1K4R/1",
        textSourceURL: "https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue",
        link: "https://www.rcsb.org/3d-view/1K4R/1",
        },
        {
        title: "Chikungunya-Virus",
        column_2: "A. albopictus, A. aegypti",
        content: `<ul style="list-style-type:disc;">
                    <li>Chikungunya is a disease transmitted to humans by mosquitoes in Africa, Asia, and the Americas; sporadic outbreaks have been reported in other regions.</li>
                    <li>Dengue and Zika have similar symptoms to chikungunya, making chikungunya easy to misdiagnose.</li>
                    <li>Chikungunya causes fever and severe joint pain, which is often debilitating and varies in duration; other symptoms include joint swelling, muscle pain, headache, nausea, fatigue and rash.</li>
                    <li>There is currently no approved vaccine or specific treatment for chikungunya virus infections.</li>
                    <li>Due to the challenges in reporting and diagnosis, the number of people affected by chikungunya is underestimated.</li>
                    <li>Severe symptoms and deaths from chikungunya are rare and usually related to other coexisting health problems.</li>
                    </ul>`,
        imageUrl: "/viruses/Chikungunya_Virus.png",
        imageCaption: "Chikungunya Virus 3D Structure",
        sourceURL: "https://www.rcsb.org/3d-view/3J2W/1",
        textSourceURL: "https://www.who.int/news-room/fact-sheets/detail/chikungunya",
        link: "https://www.rcsb.org/3d-view/3J2W/1"
        },
        {
        title: "Zika-Virus",
        column_2: "A. aegypti, (A. albopictus)",
        content:`<ul style="list-style-type:disc;">
                    <li>Zika virus is transmitted primarily by Aedes mosquitoes, which bite mostly during the day.</li>
                    <li>Most people with Zika virus infection do not develop symptoms; those who do typically have symptoms including rash, fever, conjunctivitis, muscle and joint pain, malaise and headache that last for 2–7 days.</li>
                    <li>Zika virus infection during pregnancy can cause infants to be born with microcephaly and other congenital malformations as well as preterm birth and miscarriage.</li>
                    <li>Zika virus infection is associated with Guillain-Barré syndrome, neuropathy and myelitis in adults and children.</li>
                    <li>In February 2016, WHO declared Zika-related microcephaly a Public Health Emergency of International Concern (PHEIC), and the causal link between the Zika virus and congenital malformations was confirmed. WHO declared the end of the PHEIC in November of the same year.</li>
                    <li>Although cases of Zika virus disease declined from 2017 onwards globally, transmission persists at low levels in several countries in the Americas and other endemic regions.</li>
                    </ul>`,
        imageUrl: "/viruses/Zika_Virus.png",
        imageCaption: "Zika Virus 3D Structure",
        sourceURL: "https://www.rcsb.org/3d-view/6CO8/1",
        textSourceURL: "https://www.who.int/news-room/fact-sheets/detail/zika-virus",
        link: "https://www.rcsb.org/3d-view/6CO8/1"
        },
        {
        title: "Yellow-Fever-Virus",
        column_2: "A. albopictus, A. aegypti",
        content:`<ul style="list-style-type:disc;">
                    <li>Yellow fever is an infectious disease transmitted by mosquitoes that bite mostly during the day.</li>
                    <li>As of 2023, 34 countries in Africa and 13 countries in Central and South America are either endemic for, or have regions that are endemic for, yellow fever.</li>
                    <li>Yellow fever is prevented by a vaccine, which is safe and affordable. A single dose of yellow fever vaccine is sufficient to grant life-long protection.</li>
                    <li>A modelling study based on African data sources estimated the burden of yellow fever during 2013 was 84,000–170,000 severe cases and 29,000–60,000 deaths.</li>
                    </ul>`,
        imageUrl: "/viruses/Yellow_Fever_Virus.png",
        imageCaption: "Yellow Fever Virus 3D Structure",
        sourceURL: "https://www.rcsb.org/3d-view/1NA4/1",
        textSourceURL: "https://www.who.int/news-room/fact-sheets/detail/yellow-fever",
        link: "https://www.rcsb.org/3d-view/1NA4/1"
        },
        {
        title: "Rift-Valley-Fever-Virus",
        column_2: "A. aegypti",
        content: `<ul style="list-style-type:disc;">
                    <li>Rift Valley fever (RVF) is a viral zoonosis that primarily affects animals but can also infect humans.</li>
                    <li>Most human infections result from contact with the blood or organs of infected animals.</li>
                    <li>Human infections have also resulted from the bites of infected mosquitoes.</li>
                    <li>To date, no human-to-human transmission of RVF virus has been documented.</li>
                    <li>The incubation period (the interval from infection to onset of symptoms) for RVF varies from 2 to 6 days.</li>
                    <li>Outbreaks in animals can be prevented by a sustained programme of animal vaccination.</li>
                    </ul>`,
        imageUrl: "/viruses/Rift-Valley-Virus_part_Nucleoprotein.png",
        imageCaption: "Rift Valley Fever Virus 3D Structure",
        sourceURL: "https://www.rcsb.org/3d-view/3OV9/1",
        textSourceURL: "https://www.who.int/news-room/fact-sheets/detail/rift-valley-fever",
        link: "https://www.rcsb.org/3d-view/3OV9/1"
        },
        {
        title: "West-Nil-Virus",
        column_2: "A. albopictus, A. aegypti ",
        content: `<ul style="list-style-type:disc;">
                    <li>West Nile virus can cause a fatal neurological disease in humans.</li>
                    <li>However, approximately 80% of people who are infected will not show any symptoms.</li>
                    <li>West Nile virus is mainly transmitted to people through the bites of infected mosquitoes.</li>
                    <li>The virus can cause severe disease and death in horses.</li>
                    <li>Vaccines are available for use in horses but not yet available for people.</li>
                    <li>Birds are the natural hosts of West Nile virus.</li>
                    </ul>`,
        imageUrl: "/viruses/West_Nil_Virus.png",
        imageCaption: "West Nile Virus 3D Structure",
        sourceURL: "https://www.rcsb.org/3d-view/3IYW/1",
        textSourceURL: "https://www.who.int/news-room/fact-sheets/detail/west-nile-virus",
        link: "https://www.rcsb.org/3d-view/3IYW/1"
        },
        {
          title: "Japanese encephalitis virus ",
          column_2: "A. albopictus",
          content: `<ul style="list-style-type:disc;">
                      <li>Japanese encephalitis virus (JEV) is a flavivirus related to dengue, yellow fever and West Nile viruses, and is spread by mosquitoes (especially <em>Culex</em> <em>tritaeniorhynchus</em>).</li>
                      <li>JEV is the main cause of viral encephalitis in many countries of Asia with an estimated 100 000 clinical cases every year <em>(1)</em>. </li>
                      <li>Although symptomatic Japanese encephalitis (JE) is rare, the case-fatality rate among those with encephalitis can be as high as 30%. Permanent neurologic, cognitive and behavioural sequelae occur in 30-50% of those with encephalitis. </li>
                      <li>The majority of cases occur in children below 15 years of age.</li>
                      <li>Twenty-four countries in the WHO South-East Asia and Western Pacific Regions have endemic JEV transmission, exposing more than 3 billion people to risks of infection. </li>
                      <li>There is no cure for the disease. Treatment is focused on relieving severe clinical signs and supporting the patient to overcome the infection. </li>
                      <li>Safe and effective vaccines are available to prevent JE. WHO recommends that JE vaccination be integrated into national immunization schedules in all areas where JE disease is recognized as a public health issue.</li>
                    </ul>`,
          imageUrl: "/viruses/Japanese_Encephalitis_Virus.png",
          imageCaption: "Japanese encephalitis virus 3D Structure",
          sourceURL: "https://www.rcsb.org/3d-view/5WSN/1",
          textSourceURL: "https://www.who.int/news-room/fact-sheets/detail/japanese-encephalitis",
          link: "https://www.rcsb.org/3d-view/5WSN/1"
      }
    ],
    "de": [
        {
            title: "Dengue-Virus",
            column_2: "A. albopictus, A. aegypti",
            content: `<ul style="list-style-type:disc;">
                  <li>Dengue ist eine Virusinfektion, die durch den Stich infizierter Mücken auf den Menschen übertragen wird.</li>
                  <li>Etwa die Hälfte der Weltbevölkerung ist heute dem Risiko einer Dengue-Infektion ausgesetzt, wobei jedes Jahr schätzungsweise 100 bis 400 Millionen Infektionen auftreten.</li>
                  <li>Dengue kommt weltweit in tropischen und subtropischen Klimazonen vor, hauptsächlich in städtischen und halbstädtischen Gebieten.</li>
                  <li>Während viele Dengue-Infektionen asymptomatisch verlaufen oder nur leichte Symptome hervorrufen, kann das Virus gelegentlich auch schwerere Fälle verursachen, die sogar zum Tod führen können.</li>
                  <li>Die Prävention und Kontrolle von Dengue-Fieber hängt von der Vektorkontrolle ab. Es gibt keine spezifische Behandlung für Dengue-Fieber/schweres Dengue-Fieber, und eine frühzeitige Erkennung und der Zugang zu angemessener medizinischer Versorgung senken die Sterblichkeitsrate bei schwerem Dengue-Fieber erheblich.</li>
                    </ul>`,
            imageUrl: "/viruses/Dengue_Virus.png",
            imageCaption: "Dengue Virus 3D Struktur",
            sourceURL: "https://www.rcsb.org/3d-view/1K4R/1",
            textSourceURL: "https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue",
            link: "https://www.rcsb.org/3d-view/1K4R/1",
        },
        {
          title: "Chikungunya-Virus",
          column_2: "A. albopictus, A. aegypti",
          content: `<ul style="list-style-type:disc;">
                      <li>Chikungunya ist eine Krankheit, die in Afrika, Asien und Amerika durch Moskitos auf den Menschen übertragen wird. In anderen Regionen wurden sporadische Ausbrüche gemeldet.</li>
                      <li>Dengue und Zika haben ähnliche Symptome wie Chikungunya, sodass Chikungunya leicht falsch diagnostiziert werden kann.</li>
                      <li>Chikungunya verursacht Fieber und starke Gelenkschmerzen, die oft lähmend sind und unterschiedlich lange anhalten. Zu den weiteren Symptomen gehören Gelenkschwellungen, Muskelschmerzen, Kopfschmerzen, Übelkeit, Müdigkeit und Hautausschlag.</li>
                      <li>Derzeit gibt es weder einen zugelassenen Impfstoff noch eine spezifische Behandlung für Infektionen mit dem Chikungunya-Virus.</li>
                      <li>Aufgrund der Schwierigkeiten bei der Meldung und Diagnose wird die Zahl der von Chikungunya betroffenen Menschen unterschätzt.</li>
                      <li>Schwere Symptome und Todesfälle durch Chikungunya sind selten und stehen in der Regel mit anderen gleichzeitig bestehenden Gesundheitsproblemen in Zusammenhang.</li>
                    </ul>`,
          imageUrl: "/viruses/Chikungunya_Virus.png",
          imageCaption: "Chikungunya Virus 3D Struktur",
          sourceURL: "https://www.rcsb.org/3d-view/3J2W/1",
          textSourceURL: "https://www.who.int/news-room/fact-sheets/detail/chikungunya",
          link: "https://www.rcsb.org/3d-view/3J2W/1"
      },
      {
          title: "Zika-Virus",
          column_2: "(A. albopictus), A. aegypti",
          content:`<ul style="list-style-type:disc;">
                    <li>Das Zika-Virus wird hauptsächlich von Aedes-Mücken übertragen, die vor allem tagsüber stechen.</li>
                    <li>Die meisten Menschen, die sich mit dem Zika-Virus infizieren, entwickeln keine Symptome. Bei denjenigen, bei denen dies der Fall ist, treten in der Regel Symptome wie Hautausschlag, Fieber, Bindehautentzündung, Muskel- und Gelenkschmerzen, Unwohlsein und Kopfschmerzen auf, die 2 bis 7 Tage anhalten.</li>
                    <li>Eine Infektion mit dem Zika-Virus während der Schwangerschaft kann dazu führen, dass Kinder mit Mikrozephalie und anderen angeborenen Fehlbildungen sowie Frühgeburten und Fehlgeburten geboren werden.</li>
                    <li>Eine Infektion mit dem Zika-Virus wird mit dem Guillain-Barré-Syndrom, Neuropathie und Myelitis bei Erwachsenen und Kindern in Verbindung gebracht.</li>
                    <li>Im Februar 2016 erklärte die WHO die Zika-bedingte Mikrozephalie zur gesundheitlichen Notlage von internationaler Tragweite (PHEIC), und der ursächliche Zusammenhang zwischen dem Zika-Virus und angeborenen Fehlbildungen wurde bestätigt. Die WHO erklärte das Ende der PHEIC im November desselben Jahres.</li>
                    <li>Obwohl die Fälle von Zika-Viruserkrankungen ab 2017 weltweit zurückgingen, kommt es in mehreren Ländern Amerikas und anderen endemischen Regionen weiterhin zu einer Übertragung auf niedrigem Niveau.</li>
                  </ul>`,
          imageUrl: "/viruses/Zika_Virus.png",
          imageCaption: "Zika Virus 3D Struktur",
          sourceURL: "https://www.rcsb.org/3d-view/6CO8/1",
          textSourceURL: "https://www.who.int/news-room/fact-sheets/detail/zika-virus",
          link: "https://www.rcsb.org/3d-view/6CO8/1"
      },
      {
          title: "Gelbfieber-Virus",
          column_2: "A. albopictus, A. aegypti",
          content:`<ul style="list-style-type:disc;">
                      <li>Gelbfieber ist eine Infektionskrankheit, die von Mücken übertragen wird, die hauptsächlich tagsüber stechen.</li>
                      <li>Im Jahr 2023 sind 34 Länder in Afrika und 13 Länder in Mittel- und Südamerika entweder endemisch für Gelbfieber oder haben Regionen, die endemisch für Gelbfieber sind.</li>
                      <li>Gelbfieber wird durch einen Impfstoff verhindert, der sicher und erschwinglich ist. Eine einzige Dosis Gelbfieberimpfstoff reicht aus, um lebenslangen Schutz zu gewährleisten.</li>
                      <li>Eine Modellstudie, die auf afrikanischen Datenquellen basiert, schätzte die Belastung durch Gelbfieber im Jahr 2013 auf 84.000 bis 170.000 schwere Fälle und 29.000 bis 60.000 Todesfälle.</li>
                    </ul>`,
          imageUrl: "/viruses/Yellow_Fever_Virus.png",
          imageCaption: "Gelbfieber Virus 3D Struktur",
          sourceURL: "https://www.rcsb.org/3d-view/1NA4/1",
          textSourceURL: "https://www.who.int/news-room/fact-sheets/detail/yellow-fever",
          link: "https://www.rcsb.org/3d-view/1NA4/1"
      },
      {
          title: "Rift-Valley-Fieber-Virus",
          column_2: "A. albopictus",
          content: `<ul style="list-style-type:disc;">
                      <li>Rift-Valley-Fieber (RVF) ist eine virale Zoonose, die hauptsächlich Tiere befällt, aber auch Menschen infizieren kann.</li>
                      <li>Die meisten Infektionen beim Menschen entstehen durch Kontakt mit dem Blut oder den Organen infizierter Tiere.</li>
                      <li>Infektionen beim Menschen sind auch durch den Stich infizierter Mücken entstanden.</li>
                      <li>Bisher wurde keine Übertragung des RVF-Virus von Mensch zu Mensch dokumentiert.</li>
                      <li>Die Inkubationszeit (Zeitraum zwischen Infektion und Auftreten der ersten Symptome) für das RVF-Virus variiert zwischen 2 und 6 Tagen.</li>
                      <li>Ausbrüche bei Tieren können durch ein nachhaltiges Impfprogramm für Tiere verhindert werden.</li>
                    </ul>`,
          imageUrl: "/viruses/Rift-Valley-Virus_part_Nucleoprotein.png",
          imageCaption: "Rift-Valley-Fieber Virus 3D Struktur",
          sourceURL: "https://www.rcsb.org/3d-view/3OV9/1",
          textSourceURL: "https://www.who.int/news-room/fact-sheets/detail/rift-valley-fever",
          link: "https://www.rcsb.org/3d-view/3OV9/1"
      },
      {
          title: "West-Nil-Fieber-Virus",
          column_2: "A. albopictus, A. aegypti ",
          content: `<ul style="list-style-type:disc;">
                      <li>Das West-Nil-Virus kann beim Menschen eine tödliche neurologische Erkrankung verursachen.</li>
                      <li>Allerdings zeigen etwa 80 % der infizierten Personen keine Symptome.</li>
                      <li>Das West-Nil-Virus wird hauptsächlich durch den Stich infizierter Mücken auf den Menschen übertragen.</li>
                      <li>Das Virus kann bei Pferden schwere Erkrankungen und den Tod verursachen.</li>
                      <li>Impfstoffe sind für Pferde verfügbar, aber noch nicht für Menschen.</li>
                      <li>Vögel sind die natürlichen Wirte des West-Nil-Virus.</li>
                    </ul>`,
          imageUrl: "/viruses/West_Nil_Virus.png",
          imageCaption: "West-Nil-Virus 3D Struktur",
          sourceURL: "https://www.rcsb.org/3d-view/3IYW/1",
          textSourceURL: "https://www.who.int/news-room/fact-sheets/detail/west-nile-virus",
          link: "https://www.rcsb.org/3d-view/3IYW/1"
      },
      {
        title: "Japanische Enzephalitis Virus",
        column_2: "A. albopictus",
        content: `<ul style="list-style-type:disc;">
                      <li>Das Japanische-Enzephalitis-Virus (JEV) ist ein Flavivirus, das mit Dengue-, Gelbfieber- und West-Nil-Viren verwandt ist und durch Stechmücken (insbesondere <em>Culex</em> <em>tritaeniorhynchus</em>) übertragen wird.</li>
                      <li>JEV ist die Hauptursache für virale Enzephalitis in vielen Ländern Asiens mit schätzungsweise 100.000 klinischen Fällen pro Jahr <em>(1)</em>. </li>
                      <li>Obwohl eine symptomatische japanische Enzephalitis (JE) selten ist, kann die Sterblichkeitsrate bei Enzephalitis-Patienten bis zu 30 % betragen. Bei 30–50 % der Enzephalitis-Patienten treten dauerhafte neurologische, kognitive und Verhaltensstörungen auf. </li>
                      <li>Die meisten Fälle treten bei Kindern unter 15 Jahren auf.</li>
                      <li>In 24 Ländern der WHO-Regionen Südostasien und Westpazifik kommt es zu einer endemischen JEV-Übertragung, wodurch mehr als 3 Milliarden Menschen einem Infektionsrisiko ausgesetzt sind. </li>
                      <li>Es gibt keine Heilung für die Krankheit. Die Behandlung konzentriert sich auf die Linderung schwerer klinischer Symptome und die Unterstützung des Patienten bei der Überwindung der Infektion. </li>
                      <li>Es gibt sichere und wirksame Impfstoffe zur Vorbeugung von JE. Die WHO empfiehlt, die JE-Impfung in allen Gebieten, in denen JE-Erkrankungen als Problem für die öffentliche Gesundheit anerkannt sind, in die nationalen Impfpläne aufzunehmen.</li>
                  </ul>`,
        imageUrl: "/viruses/Japanese_Encephalitis_Virus.png",
        imageCaption: "Japanische Enzephalitis Virus 3D Struktur",
        sourceURL: "https://www.rcsb.org/3d-view/5WSN/1",
        textSourceURL: "https://www.who.int/news-room/fact-sheets/detail/japanese-encephalitis",
        link: "https://www.rcsb.org/3d-view/5WSN/1"
      }
        ]
    };
  
  
  const blogVectors = {
    "en":
    [
      {
        title: "<i>Aedes albopictus</i>  (Tiger Mosquito)",
        content: "<em>Aedes albopictus </em> is a known vector of chikungunya virus, dengue virus and dirofilariasis. <br> <br> Adults are relatively small and show a black and white pattern due to the presence of white/silver scale patches against a black background on the legs and other parts of the body. Some indigenous mosquitoes also show such contrasts but these are less obvious (more brownish and yellowish). <em>Aedes albopictus</em> can, however, be confused with other invasive (<em>Ae. aegypti, Ae. japonicus</em>) or indigenous species (<em>Ae. cretinus</em>, restricted to Cyprus, Greece and Turkey), and the diagnostic character is the presence of a median silver-scale line against a black background on the scutum (dorsal part of the thorax). The differentiation with <em>Ae. cretinus</em> needs a detailed check of scale patches on the thorax.",
        imageCaption: "<i>Aedes albopictus</i> (Tiger Mosquito) sitting on skin during a blood meal.",
        imageUrl: "/mosquitos/CDC-Gathany-Aedes-albopictus-1.jpg",
        sourceURL: "https://de.wikipedia.org/wiki/Asiatische_Tigerm%C3%BCcke#/media/Datei:CDC-Gathany-Aedes-albopictus-1.jpg",
        link: "https://en.wikipedia.org/wiki/Aedes_albopictus",
        textSourceURL: "https://www.ecdc.europa.eu/en/disease-vectors/facts/mosquito-factsheets/aedes-albopictus",
        //isLoadAsBlob: true
      },
      {
        title: "<i>Aedes aegypti</i>  (Yellow Fever Mosquito)",
        content: "<i>Aedes aegypti</i> is a known vector of several viruses including yellow fever virus, dengue virus, chikungunya virus, and Zika virus.<br> <br> Adults of <em>Ae. aegypti</em> are relatively small and have a black and white pattern due to the presence of white/silver scale patches against a black background on the legs and other parts of the body. Some indigenous mosquitoes also show such contrasts (more brownish and yellowish) but these are less obvious. However, <em>Ae. Aegypti</em> could be confused with other invasive (<em>Ae. Albopictus</em>, <em>Ae. Japonicus</em>) or indigenous species (<em>Ae. Cretinus</em>, restricted to Cyprus, Greece and Türkiye). The prevailing diagnostic character is the presence of silver scales in the shape of a lyre against a black background on the scutum (dorsal part of the thorax). The domestic form (<em>Ae. Aegypti aegypti</em>) is paler than its ancestor (<em>Ae. Aegypti formosus</em>) and has white scales on the first abdominal tergite. The latter is confined to Africa, south of the Sahara, and has been recorded as breeding in natural habitats in areas of forest or bush, away from places of human settlement.",
        imageCaption: "<i>Aedes aegypti</i> (Yellow Fever Mosquito) sitting on skin during a blood meal.",
        imageUrl: "/mosquitos/Aedes_aegypti_CDC-Gathany.jpg",
        sourceURL: "https://de.wikipedia.org/wiki/Gelbfieberm%C3%BCcke#/media/Datei:Aedes_aegypti_CDC-Gathany.jpg",
        link: "https://en.wikipedia.org/wiki/Aedes_aegypti",
        textSourceURL: "https://www.ecdc.europa.eu/en/disease-vectors/facts/mosquito-factsheets/aedes-aegypti",
      }
    ],
    "de": [
      {
        title: "<i>Aedes albopictus</i>  (Tigermücke)",
        content: "<em>Aedes albopictus </em>ist ein bekannter Überträger des Chikungunya-Virus, des Dengue-Virus und der Dirofilariose. <br> <br> Erwachsene Exemplare sind relativ klein und weisen ein schwarz-weißes Muster auf, das durch weiße/silberne Schuppenflecken auf schwarzem Hintergrund an den Beinen und anderen Körperteilen entsteht. Einige einheimische Mücken weisen ebenfalls solche Kontraste auf, diese sind jedoch weniger auffällig (eher bräunlich und gelblich). <em>Aedes albopictus</em> kann jedoch mit anderen invasiven (<em>Ae. aegypti, Ae. japonicus</em>) oder einheimischen Arten (<em>Ae. cretinus</em>, auf Zypern, Griechenland und die Türkei beschränkt) verwechselt werden. Das charakteristische Merkmal ist das Vorhandensein einer silbernen Schuppenlinie auf schwarzem Hintergrund auf dem Scutum (dorsaler Teil des Thorax). Die Unterscheidung von <em>Ae. cretinus</em> erfordert eine detaillierte Untersuchung der Schuppenflecken auf dem Thorax.",
        imageUrl: "/mosquitos/CDC-Gathany-Aedes-albopictus-1.jpg",
        sourceURL: "https://de.wikipedia.org/wiki/Asiatische_Tigerm%C3%BCcke#/media/Datei:CDC-Gathany-Aedes-albopictus-1.jpg",
        link: "https://en.wikipedia.org/wiki/Aedes_albopictus",
        textSourceURL: "https://www.ecdc.europa.eu/en/disease-vectors/facts/mosquito-factsheets/aedes-albopictus",
        //isLoadAsBlob: true
      },
      {
        title: "<i>Aedes aegypti</i>  (Gelbfiebermücke)",
        content: "<i>Aedes aegypti</i> ist ein bekannter Überträger mehrerer Viren, darunter Gelbfieber-, Dengue-, Chikungunya- und Zika-Viren.<br> <br> Erwachsene Exemplare von <em>Ae. aegypti</em> sind relativ klein und weisen ein schwarz-weißes Muster auf, das durch weiße/silberne Schuppenflecken auf schwarzem Hintergrund an den Beinen und anderen Körperteilen entsteht. Einige einheimische Mücken weisen ebenfalls solche Muster auf (eher bräunlich und gelblich), aber diese sind weniger auffällig. <em>Ae. Aegypti</em> könnte jedoch mit anderen invasiven (<em>Ae. Albopictus</em>, <em>Ae. Japonicus</em>) oder einheimischen Arten (<em>Ae. Cretinus</em>, beschränkt auf Zypern, Griechenland und die Türkei) verwechselt werden. Das charakteristische Merkmal ist das Vorhandensein silberner Schuppen in Form einer Lyra vor einem schwarzen Hintergrund auf dem Scutum (dorsaler Teil des Thorax). Die Hausform (<em>Ae. Aegypti aegypti</em>) ist blasser als ihr Vorfahre (<em>Ae. Aegypti formosus</em>) und hat weiße Schuppen auf dem ersten Hinterleibssegment. Letztere ist auf Afrika südlich der Sahara beschränkt und brütet in natürlichen Lebensräumen in Wald- oder Buschgebieten, weit entfernt von menschlichen Siedlungen.",
        imageCaption: "<i>Aedes aegypti</i> (Gelbfiebermücke) auf der Haut sitzend während einer Blutmahlzeit.",
        imageUrl: "/mosquitos/Aedes_aegypti_CDC-Gathany.jpg",
        sourceURL: "https://de.wikipedia.org/wiki/Gelbfieberm%C3%BCcke#/media/Datei:Aedes_aegypti_CDC-Gathany.jpg",
        link: "https://en.wikipedia.org/wiki/Aedes_aegypti",
        textSourceURL: "https://www.ecdc.europa.eu/en/disease-vectors/facts/mosquito-factsheets/aedes-aegypti",
      }
    ],
  };

  export {blogDiseases, blogVectors};