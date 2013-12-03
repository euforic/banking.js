var Banking = require('..')
  , data = require('./fixtures/data')
  , mocha = require('mocha');

describe('Banking', function(){

  describe('banking.getStatement', function() {
    it('should return valid xml from bank server', function(done){

      var banking = Banking({
        fid: 3001,
        fidOrg: 'Wells Fargo',
        accType: 'checking',
        accId: '234343434',
        bankId: '342342',
        user: 'username',
        password: 'password',
        url: 'https://www.oasis.cfree.com/3001.ofxgp'
      });


      //If second param is omitted JSON will be returned by default
      banking.getStatement({start:20131101, end:20131120}, function (err, res) {
        if(err) done(res)
        res.body.should.be.an.instanceof(Object);
        res.body.should.have.property('OFX');
        done();
      });
    });
  });

  describe('.version', function (){
    it('should output the current version', function (done){
      Banking.version.should.equal(require('../package').version);
      done();
    });
  })

  describe('.parseFile', function(){
    it('should read the provided file and return JSON', function(done){

      Banking.parseFile(__dirname +'/fixtures/sample.ofx', function (res) {
        res.body.should.be.an.instanceof(Object);
        res.body.should.have.property('OFX');
        done();
      });
    });
  });

  describe('.parse', function(){
    it('should read the provided string and return JSON', function(done){

      Banking.parse(data.ofxString, function (res) {
        res.body.should.be.an.instanceof(Object);
        res.body.should.have.property('OFX');
        done();
      });
    });
  });
});