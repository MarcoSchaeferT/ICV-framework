# Dashboard

<div align="center">

<img src="public/iconHighDetail.svg" alt="ICV Logo" width="200" />

# ICV — Interactive Context-rich Views for Public Health Data

Open-source, composable web framework for creating release-ready public health emergency interfaces with context-rich, explainable views.

</div>

<table style="width:100%; table-layout:fixed;">
    <tr>
        <td style="text-align:center; width:16.6%;">React</td>
        <td style="text-align:center; width:16.6%;">Node v22.6.0</td>
        <td style="text-align:center; width:16.6%;">Next.js</td>
        <td style="text-align:center; width:16.6%;">Type Script</td>
        <td style="text-align:center; width:16.6%;">Tailwind CSS</td>
        <td style="text-align:center; width:16.6%;">Python 3.12</td>
        <td style="text-align:center; width:16.6%;">Flask API</td>
        <td style="text-align:center; width:16.6%;">Docker</td>
        <td style="text-align:center; width:16.6%;">PostgreSQL</td>
        <td style="text-align:center; width:16.6%;">D3</td>
    </tr>
     <tr>
        <td style="text-align:center; width:16.6%;"><img src="https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg" height="25" /></td>
        <td style="text-align:center; width:16.6%;"><img src="https://upload.wikimedia.org/wikipedia/commons/d/d9/Node.js_logo.svg" height="25" /></td>
        <td style="text-align:center; width:16.6%;"><img src="https://upload.wikimedia.org/wikipedia/commons/8/8e/Nextjs-logo.svg" height="25" /></td>
        <td style="text-align:center; width:16.6%;"> <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg" height="25" /></td>
        <td style="text-align:center; width:16.6%;"><img src="https://upload.wikimedia.org/wikipedia/commons/d/d5/Tailwind_CSS_Logo.svg" height="25" /></td>
        <td style="text-align:center; width:16.6%;"><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Python-logo-notext.svg/1920px-Python-logo-notext.svg.png" height="25" /></td>
        <td style="text-align:center; width:16.6%;">
        <img src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Flask_logo.svg" height="30" />
        </td>
        <td style="text-align:center; width:16.6%;"><img src="https://upload.wikimedia.org/wikipedia/commons/4/4e/Docker_%28container_engine%29_logo.svg" height="25" /></td>
        <td style="text-align:center; width:16.6%;">
        <img src="https://upload.wikimedia.org/wikipedia/commons/2/29/Postgresql_elephant.svg" height="25" />
        </td>
        <td style="text-align:center; width:16.6%;">
        <img src="https://d3js.org/logo.svg" height="25" />
        </td>
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
> Node, Docker, and Python have to be isntalled -> see versions above.

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
>for db access and to build the docker container there is an *.env* file at the root level of the repository where you can adjust the following content:
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
