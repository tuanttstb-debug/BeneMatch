'use strict';
/** index.js — điểm vào tầng recon (BeneMatch Batch Reconciliation). */
const { reconcile, mergeConfig, WARN_META } = require('./reconcile');
const { parseTransferCsv } = require('./csv');
const { makeStubVerifier, makeDifyVerifier } = require('./verify_client');
const normalize = require('./normalize');

module.exports = {
  reconcile, mergeConfig, WARN_META,
  parseTransferCsv,
  makeStubVerifier, makeDifyVerifier,
  normalize,
};
