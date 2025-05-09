const Banking = require('../lib/banking');
const should = require('should');
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

describe('Banking', () => {

  describe('banking.getStatement', () => {
    it('should return valid xml from the wells fargo server', async () => {

      const banking = new Banking({
        fid: 3001,
        fidOrg: 'Wells Fargo',
        accType: 'checking',
        accId: '234343434',
        bankId: '342342',
        user: 'username',
        password: 'password',
        url: 'https://www.oasis.cfree.com/3001.ofxgp'
      });

      try {
        const ofxResponse = await banking.getStatement({start:20131101, end:20131120});
        ofxResponse.body.should.be.an.instanceof(Object);
        ofxResponse.body.should.have.property('OFX');
      } catch (err) {
        // If an error occurs (promise rejected), fail the test
        throw err;
      }
    });

    /*
    it('should return valid xml from the discovercard server', function(done){

      var banking = new Banking({
        fid: 7101,
        fidOrg: 'Discover Financial Services',
        accType: 'checking',
        accId: '234343434',
        bankId: '342342',
        user: 'username',
        url: 'https://ofx.discovercard.com',
        password: 'password',
        headers: ['Content-Type', 'Host', 'Content-Length', 'Connection']
      });

      //If second param is omitted JSON will be returned by default
      banking.getStatement({start:20131101, end:20131120}, function (err, res) {
        if(err) done(res)
        res.body.should.be.an.instanceof(Object);
        res.body.should.have.property('OFX');
        done();
      });
    });
    */
  });

  describe('.version', () => {
    it('should output the current version', () => {
      Banking.version.should.eql(pkg.version);
    });
  })

  describe('.parseFile', () => {
    it('should read the provided file and return JSON', async () => { 
      try {
        const res = await Banking.parseFile('test/fixtures/sample.ofx'); 
        res.body.should.be.an.instanceof(Object);
        res.body.should.have.property('OFX');
      } catch (err) {
        throw err; 
      }
    });

    it('should read a OFX file with end-tags in elements and return JSON', async () => { 
      try {
        const res = await Banking.parseFile('test/fixtures/sample-with-end-tags.ofx'); 
        res.body.should.be.an.instanceof(Object);
        res.body.should.have.property('OFX');
      } catch (err) {
        throw err;
      }
    });
  });

  describe('.parse', () => {
    it('should read the provided string and return JSON', async () => { 
      const sampleOfxString = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX><SIGNONMSGSRSV1><SONRS><STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS><DTSERVER>20240101</DTSERVER><LANGUAGE>ENG</LANGUAGE></SONRS></SIGNONMSGSRSV1></OFX>`;
      try {
        const res = await Banking.parse(sampleOfxString); 
        res.body.should.be.an.instanceof(Object);
        res.body.should.have.property('OFX');
        res.body.OFX.SIGNONMSGSRSV1.SONRS.STATUS.CODE.should.eql('0');
      } catch (err) {
        throw err;
      }
    });
  });
});
