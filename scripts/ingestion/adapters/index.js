const { extractGeneric } = require('./common');
const mmca = require('./mmca');
const sac = require('./sac');
const sema = require('./sema');
const museum = require('./museum');
const ddp = require('./ddp');
const leeum = require('./leeum');
const busanArt = require('./busan-art');
const daeguArt = require('./daegu-art');
const sejong = require('./sejong');
const apma = require('./apma');
const warmemo = require('./warmemo');
const kukje = require('./kukje');

const adapters = {
  mmca,
  sac,
  sema,
  museum,
  ddp,
  leeum,
  'busan-art': busanArt,
  'daegu-art': daeguArt,
  sejong,
  apma,
  warmemo,
  kukje,
};

function pickAdapter(siteKey) {
  return adapters[siteKey] || { extractListItems: extractGeneric };
}

module.exports = {
  pickAdapter,
};
