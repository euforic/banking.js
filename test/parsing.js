var banking = require('../lib/banking')
  , data = require('./fixtures/data')
  , mocha = require('mocha');

describe('Ofx Statements', function(){
  describe('getStatement', function() {
    it('should return valid xml from bank server', function(done){

      var bankInfo = {
          fid: 321081669
        , fidorg: 'DI'
        , url: 'https://ofxdi.diginsite.com/cmr/cmr.ofx'
        , bankid: 321081669
        , user: 'someusername'
        , pass: 'somepassword'
        , accid: 12345678901
        , acctype: 'CHECKING'
        , date_start: 20010125
        , date_end: 20110125
      }

      //If second param is omitted JSON will be returned by default
      banking.getStatement(bankInfo, function (res, err) {
        if(err) done(err)
        res.should.be.an.instanceof(Object);
        res.should.have.property('OFX');
        done();
      });
    });
  });

  describe('parseOfxFile', function(){
    it('should read the provided file and return JSON', function(done){
      
      banking.parseOfxFile(__dirname +'/fixtures/sample.ofx', function (res, err) {
        if(err) done(err)
        res.should.be.an.instanceof(Object);
        res.should.have.property('OFX');
        done();  
      });
    });
  });

  describe('parseOfxString', function(){
    it('should read the provided string and return JSON', function(done){
      
      banking.parseOfxString(data.ofxString, function (res, err) {
        if(err) done(err)
        res.should.be.an.instanceof(Object);
        res.should.have.property('OFX');
        done();  
      });
    });
  });
});