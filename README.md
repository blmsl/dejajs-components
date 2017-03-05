[![npm version](https://badge.fury.io/js/%40deja-js%2Fcomponent.svg)](https://www.npmjs.com/package/@deja-js/component)

# @deja-js/component
This is the home for the Hôpital Univesitaire de Genève - DSI - Domaine Patient team's Angular2 components for Angular 2 and material. 


## Intro

This repository is a Angular2 components library and the the common utility functions, with a demo application to testing it.

### Node.js and npm

Node.js and Node's package manager, npm, are used for installing dependencies,
running the build steps, and running tests.

### Getting started 

Begin by cloning the repository.

Use npm to get dependencies:

`npm install`

Take a look at the `src` folder. All components and demo application are placed here. 


## Running demo app 

`npm start`

and navigate to `http://localhost:5100`.


## Feature status and browsers compatibility:

| Feature          | Working OnPush| Chrome 56 | Edge | IE11 | FF51 | Opera Neon | Readme and Demo | Note           |
|------------------|-|-|-|-|-|-|-|-|
| Accordion        |yes|yes|yes|yes|yes|yes|available|
| Auto-Size TextArea|yes|yes|yes|yes|yes|yes|<span style="color:red">@todo</span>|Scroll on IE11, Place holder on FF
| Circular Picker  |<span style="color:red">no</span>|yes|yes|yes|yes|yes|available|
| Color Selector   |yes|yes|yes|yes|yes|yes|available|
| Color Picker     |yes|yes|yes|yes|yes|yes|available|
| Content Editable |yes|yes|yes|yes|yes|yes|available|New line issue on IE11
| Date Selector    |yes|yes|<span style="color:red">slow</span>|<span style="color:red">slow</span>|yes|yes|available|
| Date Picker      |<span style="color:red">no</span>|yes|<span style="color:red">no</span>|<span style="color:red">no</span>|<span style="color:red">no</span>|yes|available
| Dialog           |yes|yes|yes|yes|yes|yes|Message Box|
| Events           |yes|yes|yes|yes|yes|yes|<span style="color:red">@todo</span>|
| Grid             |<span style="color:red">no</span>|yes|yes|<span style="color:red">no</span>|<span style="color:red">slow</span>|yes|available|
| Dropdown Control |yes|yes|yes|yes|yes|yes|Color Picker|
| Menu             |yes|yes|yes|yes|yes|yes|<span style="color:red">@todo</span>|
| Message Box      |yes|yes|yes|<span style="color:red">no</span>|yes|yes|available|Styling Issue on IE11
| Monaco Editor    |yes|yes|yes|yes|yes|yes|available|
| Range            |<span style="color:red">no</span>|yes|yes|yes|<span style="color:red">no</span>|yes|available|
| Select           |<span style="color:red">no</span>|yes|yes|yes|yes|yes|<span style="color:red">@todo</span>|Place Holder placement in FF, Edge and IE11
| Snackbar         |yes|yes|yes|<span style="color:red">no</span>|yes|yes|available|Styling Issue on IE11
| Splitter         |yes|yes|yes|yes|yes|yes|available|
| Tiles            |@rxjs Branch|yes|yes|yes|yes|yes|<span style="color:red">@todo</span>|
| Tooltip          |yes|yes|yes|<span style="color:red">no</span>|yes|yes|Message Box|Styling Issue on IE11
| Treelist         |<span style="color:red">no</span>|yes|yes|yes|yes|yes|available|
