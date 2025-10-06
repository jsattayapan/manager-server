// server.js
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 2229;

// Middleware (optional)
app.use(express.json());

// Example route
app.get('/', (req, res) => {
  res.send('✅ Express server is running on port ' + PORT);
});


// Body Parser Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }))

  app.use(cors());

  app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Methods','GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  })

    app.use('/fingerScanDevice', require('./api/fingerScanner'));
    app.use('/login', require('./api/authentication'))
    app.use('/deptManager', require('./api/deptManager'))
    app.use('/hr', require('./api/hr'))


// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
