function logServerError(operation, error) {
  // Raw messages, request bodies/headers and connection strings may contain secrets.
  const details = { operation, name: error.name, code: error.code, codeName: error.codeName };
  if (error.code === 20) details.reason = 'MongoDB transactions require a replica set or mongos';
  if (process.env.NODE_ENV !== 'production') {
    details.frames = (error.stack || '').split('\n').filter(line => /^\s+at /.test(line)).slice(0, 8);
  }
  console.error('Server operation failed:', JSON.stringify(details));
}
module.exports = logServerError;
