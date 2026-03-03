const express = require('express');
const app = express();
const path = require('path');
const PORT = 3000;
const controller = require('./controllers');


app.use('/build', express.static(path.join(__dirname, '../build')));

//API Call
app.get('./', controller.apiCall, (req, res) => {
  return res.status(200).send(res);
})

// global error handler
app.use((err, req, res, next) => {
  const defaultErr = {
    log: 'Express error handler caught unknown middleware error',
    status: 500,
    message: { err: 'An error occurred' },
  };
  const errorObj = Object.assign({}, defaultErr, err);
  console.log(errorObj.log);
  return res.status(errorObj.status).json(errorObj.message);
});


//local host running. 
app.listen(PORT, () => {
  console.log(`Server listening on port: ${PORT}...`);
});
  module.exports = app;