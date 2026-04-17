# Dashboard

<div align="center">

<img src="public/iconHighDetail.svg" alt="ICV Logo" width="200" />

# ICV — Interactive Context-rich Views for Public Health Data

Open-source, composable web framework for creating release-ready public health emergency interfaces with context-rich, explainable views.

</div>

<table style="width:100%;">
    <tr>
        <td align="center">React</td>
        <td align="center">Node 25.8</td>
        <td align="center">Next.js</td>
        <td align="center">TypeScript</td>
        <td align="center">Tailwind CSS</td>
        <td align="center">Python 3.12</td>
        <td align="center">Flask API</td>
        <td align="center">Docker 29.3</td>
        <td align="center">PostgreSQL</td>
        <td align="center">D3</td>
        <td align="center">Leaflet</td>
        <td align="center">Recharts</td>
    </tr>
     <tr>
        <td align="center"><img src="https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg" height="25" /></td>
        <td align="center"><img src="https://upload.wikimedia.org/wikipedia/commons/d/d9/Node.js_logo.svg" height="25" /></td>
        <td align="center"><img src="https://upload.wikimedia.org/wikipedia/commons/8/8e/Nextjs-logo.svg" height="25" /></td>
        <td align="center"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg" height="25" /></td>
        <td align="center"><img src="https://upload.wikimedia.org/wikipedia/commons/d/d5/Tailwind_CSS_Logo.svg" height="25" /></td>
        <td align="center"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Python-logo-notext.svg/1920px-Python-logo-notext.svg.png" height="25" /></td>
        <td align="center"><img src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Flask_logo.svg" height="30" /></td>
        <td align="center"><img src="https://upload.wikimedia.org/wikipedia/commons/4/4e/Docker_%28container_engine%29_logo.svg" height="25" /></td>
        <td align="center"><img src="https://upload.wikimedia.org/wikipedia/commons/2/29/Postgresql_elephant.svg" height="25" /></td>
        <td align="center"><img src="https://d3js.org/logo.svg" height="25" /></td>
        <td align="center"><img src="https://leafletjs.com/docs/images/logo.png" height="25" /></td>
        <td align="center"><img src="https://img.shields.io/badge/Recharts-3.8.0-0F766E" height="25" /></td>
    </tr>
</table>

## Run the tool
To run the tool execute the following command: 
```bash
docker compose up
```

## Build Dependencies

>
> [!NOTE]
> If you want to further develop and/or build the tool yourself, the following dependencies are prerequisites:
> Node, Docker, and Python have to be installed -> see versions above.

```bash
#install packages
npm install

```

## Local Development
> [!WARNING]
> Ensure that the docker service is running!

```bash
# run database & build + watch changes + run website 
npm run dev
```

page available at: [http://localhost:3000](http://localhost:3000) (see terminal log)

> [!NOTE]
>or DB access and building the docker container there is an *.env* file at the root level of the repository where you can adjust the following content:
>* DATABASE_URL="postgresql://icv_user:<DB_PASSWORD>@icv-database:5333/icv-database?schema=public"
>* DATABASE_URL_SECRET="postgresql://icv_user:<DB_PASSWORD>@icv-database:5333/icv-database?schema=public"
>* DB_PASSWORD_SECRET="<DB_PASSWORD>"

To debug or develop the backend, use two terminals (one for the backend and one for the frontend and database):
```bash
# 1. terminal:
npm run flask-dev

# 2. terminal
npm run dev
```

## Production Build

```bash
#Build your app: 
npm run build

#Run your app: 
npm run start
```

# Docker

* ## Dockerize the Application

    ```bash
    # build & run the application
    npm run docker
    ```
  * ### (optional) dev commands
    * #### start containers
        ```bash
        # only start the already build containers: 
        npm run docker-run
        ```
    * #### force a clean rebuild of the images and run containers
        ```bash
        # build & run
        npm run docker-noCache
        ```

    * #### individually build & run Docker containers

        ```bash
        #Build your containers: 
        docker compose build icv-database
        docker compose build icv-backend
        docker compose build icv-frontend

        #Run your containers (each in an individual terminal): 
        docker compose up icv-database
        docker compose up icv-backend
        docker compose up icv-frontend
        ```

## Inspect the Database

```bash
# starts db & opens prisma studio 
npm run db-view
```

## General Info

see also [next.js_docu_deployment](https://nextjs.org/docs/app/building-your-application/deploying)

## License

This project is licensed under the **GNU GPL-3.0 License** - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2026 ICV Contributors

## Funding

This project is funded by the Federal Ministry of Health (BMG) under grant No. 2523DAT400 (project: AI-DAVis PANDEMICS)

<img src="public/bmas_offic_farbe_de_wbz.png" alt="Federal Ministry of Health Logo" width="150">

For more information about the project and funding, see: [AI-DAVis PANDEMICS](https://www.bundesgesundheitsministerium.de/ministerium/ressortforschung/handlungsfelder/digitalisierung/ai-davis-pandemics.html)

### Third-Party Licenses

This project uses many open-source libraries and components. For a comprehensive list of all dependencies and their licenses, see [DEPENDENCIES.md](DEPENDENCIES.md).

**Key Dependencies Highlights:**
- **Frontend:** React, Next.js, Tailwind CSS (MIT/Apache-2.0)
- **Backend:** Flask, NumPy, PostgreSQL drivers (BSD-3-Clause)
- **UI Components:** Radix UI, Recharts, D3, Leaflet
- **Icons:** Font Awesome (CC BY 4.0), Game Icons (CC BY 3.0)
- **Utilities:** Swapy (GPL-3.0), Prisma (Apache-2.0)

