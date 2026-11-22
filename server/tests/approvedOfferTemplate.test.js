process.env.NODE_ENV = 'test';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { PDFDocument } = require('pdf-lib');
const config = require('../src/config/approvedOfferTemplate');
const fields = require('../src/config/approvedOfferFields.json');
const env = require('../src/config/env');
const { app } = require('../src/index');
const Admin = require('../src/models/Admin');
const Program = require('../src/models/Program');
const Participant = require('../src/models/Participant');
const Application = require('../src/models/Application');
const Template = require('../src/models/OfferLetterTemplate');
const { generateOfferForApplication } = require('../src/services/offerService');
const { renderOfferPdf } = require('../src/services/offerPdfService');

(async () => {
  const mongod = await MongoMemoryServer.create();
  let server;
  try {
    await mongoose.connect(mongod.getUri());
    await Promise.all([Admin.init(), Program.init(), Participant.init(), Application.init(), Template.init()]);
    const admin = await Admin.create({name:'Isolated Test Admin',email:'admin@example.invalid',passwordHash:'not-a-live-login',role:'SUPER_ADMIN',isActive:true});
    const token = jwt.sign({id:admin.id},env.JWT_SECRET);
    server = await new Promise(resolve => {const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
    const base=`http://127.0.0.1:${server.address().port}/api/v1/admin/offer-templates`;
    const request=async (suffix,options={})=>{
      const res=await fetch(base+suffix,{...options,headers:{authorization:`Bearer ${token}`,...options.headers}});
      if(res.headers.get('content-type')?.includes('application/pdf'))return {status:res.status,buffer:Buffer.from(await res.arrayBuffer())};
      return {status:res.status,data:await res.json()};
    };
    assert.deepStrictEqual(fields.map(f=>f.id),['applicationId','issueDate','studentName','email','phone','programTitle','startDate']);
    assert.strictEqual(config.identifyApprovedOffer(Buffer.from('unknown')).approved,false);
    assert.throws(()=>config.validateApprovedOfferProgram({pdfSha256:config.APPROVED_OFFER_SHA256},{durationWeeks:12,startDate:new Date()}),/4 weeks/);
    assert.throws(()=>config.validateApprovedOfferProgram({pdfSha256:config.APPROVED_OFFER_SHA256},{durationWeeks:4}),/Start Date/);
    console.log('PASS: seven mappings, unknown-asset handling, duration and start-date guards');

    const privatePdf=process.env.NOXIRA_APPROVED_OFFER_PDF;
    const pdf=privatePdf ? fs.readFileSync(privatePdf) : Buffer.from(await (await PDFDocument.create()).save());
    if(!privatePdf){
      console.log('SKIP: exact signed-asset HTTP/render checks. Set NOXIRA_APPROVED_OFFER_PDF to the privately delivered approved PDF. No signed asset is in git.');
      return;
    }
    assert.strictEqual(config.identifyApprovedOffer(pdf).approved,true,'Private input must be the exact approved PDF');
    const form=new FormData();form.append('templatePdf',new Blob([pdf],{type:'application/pdf'}),'approved-private.pdf');
    const upload=await request('/upload',{method:'POST',body:form});
    assert.strictEqual(upload.status,201,JSON.stringify(upload.data));
    const draft=upload.data.template;
    assert.strictEqual(draft.isActive,false);
    assert.strictEqual(draft.pdfSha256,config.APPROVED_OFFER_SHA256);
    assert.deepStrictEqual(draft.fields.map(({_id,...f})=>f),fields);
    const preview=await request(`/${draft._id}/preview`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    assert.strictEqual(preview.status,200);assert((await PDFDocument.load(preview.buffer)).getPageCount()===1);
    console.log('PASS: authenticated private upload recognizes exact PDF, all positions saved, inactive draft, preview PDF generated');

    const activate=await request(`/${draft._id}/activate`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({confirmation:true})});
    assert.strictEqual(activate.status,200,JSON.stringify(activate.data));
    const changed=fields.map(f=>({...f,x:f.x+1}));
    const update=await request(`/${draft._id}`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({fields:changed})});
    assert.strictEqual(update.status,201);assert(update.data.isNewVersion);
    assert.strictEqual(update.data.template.isActive,false);assert.strictEqual(update.data.template.pdfSha256,config.APPROVED_OFFER_SHA256);
    assert.strictEqual((await Template.findById(draft._id)).fields[0].x,fields[0].x);
    console.log('PASS: explicit isolated activation and versioned placement edits preserve original active template/hash');

    const program=await Program.create({code:'FSD',title:'Full Stack Development',durationWeeks:4,startDate:new Date('2026-12-10T12:00:00+05:30'),isActive:true});
    const p=await Participant.create({fullName:'Alex Example',email:'alex@example.invalid',normalizedEmail:'alex@example.invalid',normalizedName:'alex example',phone:'+91 90000 00000',programCode:'FSD',programTitle:program.title,batchId:'TEST-ONLY',source:'CSV_IMPORT'});
    const application=await Application.create({applicationId:'NOX-TEST23',participantId:p._id,programCode:'FSD',programTitle:program.title,batchId:'TEST-ONLY',status:'APPROVED'});
    const result=await generateOfferForApplication(application.applicationId);
    assert.strictEqual(result.offerLetter.generationStatus,'GENERATED');
    assert.strictEqual(result.deliveryJob.status,'QUEUED');
    assert.strictEqual(result.deliveryJob.attempts,0);
    const out=process.env.NOXIRA_OFFER_TEST_OUTPUT;
    if(out){
      fs.mkdirSync(out,{recursive:true});
      fs.copyFileSync(result.offerLetter.pdfPath,path.join(out,'offer-generated-synthetic.pdf'));
      fs.writeFileSync(path.join(out,'offer-admin-preview.pdf'),preview.buffer);
      fs.writeFileSync(path.join(out,'offer-long-synthetic.pdf'),await renderOfferPdf(pdf,fields,{studentName:'Alexandra Krishnamurthy Subramanian Example',email:'alexandra.krishnamurthy@example.invalid',phone:'+91 90000 00000',applicationId:'NOX-TEST99',programTitle:'Artificial Intelligence and Machine Learning Engineering',issueDate:new Date('2026-11-20T12:00:00+05:30'),startDate:new Date('2026-12-10T12:00:00+05:30')},{isSample:false}));
    }
    await Program.updateOne({_id:program._id},{$set:{durationWeeks:12}});
    const p2=await Participant.create({fullName:'Second Example',normalizedName:'second example',email:'second@example.invalid',normalizedEmail:'second@example.invalid',programCode:'FSD',programTitle:program.title,batchId:'TEST-ONLY',source:'CSV_IMPORT'});
    await Application.create({applicationId:'NOX-TEST24',participantId:p2._id,programCode:'FSD',programTitle:program.title,batchId:'TEST-ONLY',status:'APPROVED'});
    await assert.rejects(()=>generateOfferForApplication('NOX-TEST24'),/4 weeks/);
    console.log('PASS: real offer service generates signed sample with actual record data; queued email never processed; incompatible programme rejected');
    console.log('ALL APPROVED OFFER INTEGRATION CHECKS PASSED. Isolated database only. No external emails.');
  } finally {
    if(server)await new Promise(resolve=>server.close(resolve));
    await mongoose.disconnect();await mongod.stop();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
