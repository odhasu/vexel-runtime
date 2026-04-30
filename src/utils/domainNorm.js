function normalizeDomain(d) {
  return (d || '').replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '').toLowerCase();
}

module.exports = normalizeDomain;
