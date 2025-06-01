# Guide to run locally the app

## Clone the github repository

The app code is stored and maintained in the repo: https://github.com/the-future-dev/odissey/

To generate a local version of it:

```bash
git clone https://github.com/the-future-dev/odissey.git
```

## Front-end

### Installation

The frontend of the application is in React Native. Therefore, in order to execute it locally, we need to install Node.JS.

**Follow the installation guide**: https://nodejs.org/en/download

Installation control:

```bash
npm -v
```

 The above command should output something similar to *“version xx.xx”* 

The Frontend is fully maintained inside the folder “Odyssey". After the installation of Node.js, we have to install the package dependencies of the app. Therefore open the folder:

 

```bash
cd odissey/odissey
npm i
```

To execute the application:

```bash
npx expo start
```

### Usage

Each time you want to use the repository run:

- inside “odissey/”:
    
    ```bash
    	git pull
    ```
    
- inside “odissey/odissey/”
    
    ```bash
    npm i
    ```
    
- then the command to run 🏃🏼‍♀️💨
    
    ```bash
    npx expo start
    ```
    
    Optional flags to add after the command:
    
    - --tunnel
        
        allows the application to be built by devices outside the WiFi scope
        
    - -d
        
        allows the developer mode