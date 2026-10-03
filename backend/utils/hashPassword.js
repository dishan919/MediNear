const bcrypt = require("bcryptjs");

module.exports = async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};
