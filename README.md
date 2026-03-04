
  # Minicms con menu JSON

  This is a code bundle for Minicms con menu JSON. The original project is available at https://www.figma.com/design/UaDypThSWpuAti0XznpI7c/Minicms-con-menu-JSON.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.
  
  
  ## docker

  Use Docker Compose v2:

  `docker compose up --build -d`

  If you previously used `docker-compose` v1 and hit an error like `'ContainerConfig'`, clean up the old stack first:

  `docker compose down --remove-orphans`

  If needed, remove the old standalone container too:

  `docker rm -f minicms`
