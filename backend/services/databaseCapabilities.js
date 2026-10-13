const mongoose = require('mongoose');
async function supportsTransactions(connection = mongoose.connection) {
  // Inspect the actual server topology; never infer safety from NODE_ENV.
  const hello = await connection.db.admin().command({ hello: 1 });
  return Boolean(hello.setName || hello.msg === 'isdbgrid');
}
module.exports = { supportsTransactions };
