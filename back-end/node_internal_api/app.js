import { OpaqueServer } from '@cloudflare/opaque-ts';
const express = require('express');
const app = express();
const port = 3000; // this might be changed, i believe it's best if we set an ENV for it

// so this converts json to js objects
app.use(express.json());

// registration routes
app.get('/register/init', (req, res) => {
 
});

app.post('/register/finish', (req, res) => {
  
});

// login routes
app.get('/login/init', (req, res) => {
  
});

app.post('/login/finish', (req, res) => {
  
});
// to do, implement routing thru the python flask server
// start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});