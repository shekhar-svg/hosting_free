'use strict';
const $=id=>document.getElementById(id);
const KEY='officeLaptopStock_v2';
const STATUSES=['In Stock','Dispatched','Issued','Sold','Repair','Replacement','Dent'];
const FIELDS=['serial','brand','generation','model','specs','enquiry','purchaseDate','purchasePrice','supplier','invoice','warranty','status','holder','sellingPrice','movementDate','notes'];
const HEADERS=['Serial Number','Brand','Processor Generation','Model','Specifications','Customer Enquiry','Purchase Date','Purchase Cost','Supplier','Purchase Invoice','Warranty Expiry','Status','Customer / Staff','Selling Price','Issue / Status Date','Notes'];
// Supabase project settings: paste your Project URL and Publishable key below. Never use a secret/service-role key here.
const SUPABASE_URL='https://vxukuuyglinpsrnlfvor.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_egqYq3Sx4QzqsTVPu2sgiA_hc-evDm6';
const supabaseClient=(window.supabase&&SUPABASE_URL.startsWith('https://')&&SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_'))?window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY):null;
let remoteSyncEnabled=false,remoteSyncQueues={},storageSyncInstalled=false;
let currentRole=null,editingId=null,laptops=loadData();
const EMP_KEY='dosElectronicsEmployees_v1',COURIER_KEY='dosElectronicsCouriers_v1',PAYROLL_KEY='dosElectronicsPayroll_v1',CUSTOMER_KEY='dosElectronicsCustomers_v1';
let employees=readStore(EMP_KEY,[]),couriers=readStore(COURIER_KEY,[]),payrolls=readStore(PAYROLL_KEY,[]),customers=loadCustomers();
function readStore(key,fallback){try{const v=JSON.parse(localStorage.getItem(key)||'null');return Array.isArray(v)?v:fallback}catch{return fallback}}
function writeStore(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch(e){alert('Could not save. Browser storage may be full. Download a backup.');return false}}
function loadCustomers(){
  // Prefer a populated store over an empty newer-version key, so legacy customer
  // records are not hidden by an empty migration key.
  let emptyFallback=null;
  for(const key of [CUSTOMER_KEY,'dosElectronicsCustomers_v1','officeCustomers_v1','customers']){
    try{
      const raw=localStorage.getItem(key);if(!raw)continue;
      const data=JSON.parse(raw);const list=Array.isArray(data)?data:(Array.isArray(data.customers)?data.customers:null);if(!list)continue;
      const cleaned=list.filter(x=>x&&String(x.name||x.customerName||'').trim()).map(x=>({...x,id:x.id||makeId('CUS'),name:String(x.name||x.customerName||'').trim(),address:String(x.address||x.customerAddress||'').trim(),phone:String(x.phone||'').trim(),email:String(x.email||'').trim(),gstin:String(x.gstin||x.gst||'').trim()}));
      if(cleaned.length){if(key!==CUSTOMER_KEY){try{localStorage.setItem(CUSTOMER_KEY,JSON.stringify(cleaned))}catch(e){console.warn('Could not migrate customer records',e)}}return cleaned;}
      if(emptyFallback===null)emptyFallback=cleaned;
    }catch(e){console.warn('Could not load customer records from',key,e)}
  }
  return emptyFallback||[];
}
function resetCustomerForm(){if(!$('customerForm'))return;$('customerForm').reset();$('customerEditId').value='';$('customerFormTitle').textContent='Add Customer'}
function renderCustomers(){if(!$('customerTable'))return;const q=($('customerTableSearch')?.value||'').toLowerCase();const rows=customers.filter(x=>[x.name,x.phone,x.email,x.address,x.gstin].join(' ').toLowerCase().includes(q));$('customerTable').innerHTML=rows.length?'<div class="tablewrap"><table><thead><tr><th>Customer Name</th><th>Phone</th><th>Email</th><th>GSTIN</th><th>Address</th><th>Actions</th></tr></thead><tbody>'+rows.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.phone||'—')}</td><td>${esc(x.email||'—')}</td><td>${esc(x.gstin||'—')}</td><td style="white-space:normal;min-width:220px">${esc(x.address||'—')}</td><td><div class="actions"><button class="light" onclick="editCustomer('${escAttr(x.id)}')">Edit</button><button class="danger" onclick="deleteCustomer('${escAttr(x.id)}')">Delete</button></div></td></tr>`).join('')+'</tbody></table></div>':'<div class="empty">No customers yet. Add a customer above.</div>';refreshCustomerDropdown()}
function refreshCustomerDropdown(){const el=$('dcCustomer');if(!el)return;const old=el.value;el.innerHTML='<option value="">Select customer from Customer Management</option>'+customers.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(x=>`<option value="${escAttr(x.id)}">${esc(x.name)}</option>`).join('');if(customers.some(x=>x.id===old))el.value=old;fillChallanCustomer()}
function fillChallanCustomer(){const x=customers.find(c=>c.id===$('dcCustomer')?.value);if($('dcAddress'))$('dcAddress').value=x?x.address||'':''}
function editCustomer(id){const x=customers.find(y=>y.id===id);if(!x)return;$('customerEditId').value=x.id;$('customerNameInput').value=x.name||'';$('customerPhoneInput').value=x.phone||'';$('customerEmailInput').value=x.email||'';$('customerGSTInput').value=x.gstin||'';$('customerAddressInput').value=x.address||'';$('customerFormTitle').textContent='Edit Customer';$('customerForm').scrollIntoView({behavior:'smooth'})}
function deleteCustomer(id){const x=customers.find(y=>y.id===id);if(!x)return;if(!confirm('Delete customer '+x.name+'?'))return;customers=customers.filter(y=>y.id!==id);if(writeStore(CUSTOMER_KEY,customers)){renderCustomers();refreshCustomerDropdown()}}
$('customerForm')?.addEventListener('submit',e=>{e.preventDefault();if(currentRole!=='admin')return;const id=$('customerEditId').value,name=$('customerNameInput').value.trim(),address=$('customerAddressInput').value.trim();if(!name||!address){alert('Please enter customer name and address.');return}if(customers.some(x=>x.name.toLowerCase()===name.toLowerCase()&&x.id!==id)){if(!confirm('A customer with this name already exists. Save another record?'))return}const item={id:id||makeId('CUS'),name,phone:$('customerPhoneInput').value.trim(),email:$('customerEmailInput').value.trim(),gstin:$('customerGSTInput').value.trim(),address};customers=id?customers.map(x=>x.id===id?item:x):[item,...customers];if(writeStore(CUSTOMER_KEY,customers)){resetCustomerForm();renderCustomers();refreshCustomerDropdown();alert('Customer saved successfully.')}});
$('dcCustomer')?.addEventListener('change',fillChallanCustomer);
function makeId(prefix){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7)}
function safeMoney(v){return Number(v||0).toLocaleString('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2})}
function escAttr(v){return esc(v).replace(/'/g,'&#39;')}


function loadData(){
  // Prefer the first populated compatible store. An empty v2 key must not mask
  // records that still exist under the previous version's key.
  const keysToTry=[KEY,'officeLaptopStock_v1','officeLaptopStock'];
  let emptyFallback=null;
  for(const key of keysToTry){
    try{
      const raw=localStorage.getItem(key);if(!raw)continue;
      const data=JSON.parse(raw);
      const records=Array.isArray(data)?data:(Array.isArray(data.laptops)?data.laptops:null);
      if(!records)continue;
      const cleaned=records.filter(x=>x&&String(x.serial||'').trim()).map(x=>({...x,id:x.id||uid(),serial:String(x.serial||'').trim().toUpperCase(),status:STATUSES.includes(x.status)?x.status:'In Stock',purchasePrice:Number(x.purchasePrice)||0,sellingPrice:x.sellingPrice===''||x.sellingPrice==null?'':Number(x.sellingPrice)||0}));
      if(cleaned.length){
        if(key!==KEY){try{localStorage.setItem(KEY,JSON.stringify(cleaned))}catch(err){console.warn('Could not migrate inventory into current key',err)}}
        return cleaned;
      }
      if(emptyFallback===null)emptyFallback=cleaned;
    }catch(err){console.warn('Could not read saved inventory from',key,err)}
  }
  return emptyFallback||[];
}
function uid(){return 'L'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function todayISO(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function money(n){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(n)||0)}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function saveData(){try{localStorage.setItem(KEY,JSON.stringify(laptops));renderAll();return true}catch(err){alert('Could not save inventory in this browser. Storage may be disabled or full. Download a backup and try again.');console.error(err);return false}}
function optionList(id,values,placeholder,selected=''){const el=$(id);if(!el)return;el.replaceChildren();const first=document.createElement('option');first.value='';first.textContent=placeholder;el.append(first);values.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;el.append(o)});if(values.includes(selected))el.value=selected}
function distinct(field){return [...new Set(laptops.map(x=>String(x[field]??'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b))}
function populateDatalist(id,values){const list=$(id);if(!list)return;list.replaceChildren();values.forEach(v=>{const o=document.createElement('option');o.value=v;list.append(o)})}
function refreshDynamicOptions(){populateDatalist('brandOptions',distinct('brand'));populateDatalist('generationOptions',distinct('generation'));populateDatalist('specsOptions',distinct('specs'));populateDatalist('enquiryOptions',distinct('enquiry'));optionList('status',STATUSES,'Select status',$('status')?.value);optionList('statusFilter',STATUSES,'All statuses',$('statusFilter')?.value);const oldBrand=$('customerBrand')?.value||'',oldSpecs=$('customerSpecs')?.value||'';const available=laptops.filter(x=>x.status==='In Stock');const valuesFor=field=>[...new Set(available.map(x=>String(x[field]??'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));optionList('customerBrand',valuesFor('brand'),'All brands',oldBrand);optionList('customerSpecs',valuesFor('specs'),'All specifications',oldSpecs)}
function statusPill(s){const c=s==='In Stock'?'in':s==='Repair'?'repair':s==='Dent'?'dent':s==='Replacement'?'replacement':s==='Dispatched'?'dispatched':'out';return `<span class="pill ${c}">${esc(s||'Unknown')}</span>`}
function tableHTML(items){if(!items.length)return '<div class="empty">No laptop records found.</div>';return `<div class="tablewrap"><table><thead><tr><th>Serial Number</th><th>Model</th><th>Brand</th><th>Generation</th><th>Specifications</th><th>Enquiry</th><th>Purchase Date</th><th>Cost</th><th>Status</th><th>Customer / Staff</th><th>Selling Price</th><th>Actions</th></tr></thead><tbody>${items.map(x=>`<tr><td>${esc(x.serial)}</td><td>${esc(x.model)}</td><td>${esc(x.brand)}</td><td>${esc(x.generation||'—')}</td><td>${esc(x.specs||'—')}</td><td>${esc(x.enquiry||'—')}</td><td>${esc(x.purchaseDate||'—')}</td><td>${money(x.purchasePrice)}</td><td>${statusPill(x.status)}</td><td>${esc(x.holder||'—')}</td><td>${x.sellingPrice!==''&&x.sellingPrice!=null?money(x.sellingPrice):'—'}</td><td><div class="actions">${currentRole==='admin'?`<button class="light" onclick="openForm('${esc(x.id)}')">Edit</button><button class="danger" onclick="deleteLaptop('${esc(x.id)}')">Delete</button>`:'—'}</div></td></tr>`).join('')}</tbody></table></div>`}
function renderDashboard(){
  const inStock=laptops.filter(x=>x.status==='In Stock').length;
  const outStock=laptops.filter(x=>['Dispatched','Issued','Sold'].includes(x.status)).length;
  $('total').textContent=laptops.length;$('instock').textContent=inStock;$('outstock').textContent=outStock;
  $('stockvalue').textContent=money(laptops.filter(x=>x.status==='In Stock').reduce((a,x)=>a+Number(x.purchasePrice||0),0));
  const statuses=['In Stock','Dispatched','Issued','Sold','Repair','Replacement','Dent'];
  const colors={'In Stock':'#0e9f6e','Dispatched':'#0891b2','Issued':'#1769e8','Sold':'#7846d7','Repair':'#d97706','Replacement':'#8b5cf6','Dent':'#e11d48'};
  const statusCounts=statuses.map(status=>({status,count:laptops.filter(x=>x.status===status).length}));
  const statusHost=$('statusChart');
  if(statusHost){
    if(!laptops.length){statusHost.innerHTML='<div class="chart-empty">Add or import laptop records to see the pie chart.</div>'}
    else {
      let cursor=0;
      const slices=statusCounts.filter(o=>o.count>0).map(o=>{const from=cursor;cursor+=o.count/laptops.length*100;return `${colors[o.status]} ${from}% ${cursor}%`}).join(',');
      statusHost.innerHTML=`<div class="pie-layout"><div class="pie-chart" role="img" aria-label="Pie chart showing laptop status distribution" style="background:conic-gradient(${slices})"></div><div class="pie-legend">${statusCounts.filter(o=>o.count>0).map(o=>`<div class="legend-item"><span class="legend-dot" style="background:${colors[o.status]}"></span><span>${esc(o.status)}</span><span class="legend-value">${o.count} · ${Math.round(o.count/laptops.length*100)}%</span></div>`).join('')}</div></div>`;
    }
  }
  const brands={};laptops.forEach(x=>{const brand=(x.brand||'Other').trim()||'Other';brands[brand]=(brands[brand]||0)+1});
  const brandRows=Object.entries(brands).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,10);const max=brandRows.length?brandRows[0][1]:0;
  const brandHost=$('brandChart');
  if(brandHost)brandHost.innerHTML=brandRows.length?brandRows.map(([brand,count])=>`<div class="brand-row"><span class="brand-name" title="${esc(brand)}">${esc(brand)}</span><div class="bar-track"><div class="bar-fill" style="width:${max?count/max*100:0}%"></div></div><strong>${count}</strong></div>`).join(''):'<div class="chart-empty">Add or import laptop records to see the brand bar chart.</div>';
  if($('dashboardTable')&&!$('dashboardTable').dataset.filter)showDashboardTable('all',false);
}
function showDashboardTable(filter,scroll=true){
  let items=laptops,title='All Laptop Records';
  if(filter==='In Stock'){items=laptops.filter(x=>x.status==='In Stock');title='Currently In-Stock Laptops'}
  else if(filter==='Outbound'||filter==='IssuedSold'){items=laptops.filter(x=>['Dispatched','Issued','Sold'].includes(x.status));title='Dispatched / Issued / Sold Laptops'}
  $('dashboardTableTitle').textContent=title;
  $('dashboardTable').dataset.filter=filter;
  $('dashboardTable').innerHTML=items.length?tableHTML(items):'<div class="empty">No laptop records in this category.</div>';
  if(scroll)$('dashboardTable').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function renderInventory(){const q=($('search')?.value||'').trim().toLowerCase(),s=$('statusFilter')?.value||'';const items=laptops.filter(x=>(!s||x.status===s)&&FIELDS.some(k=>String(x[k]??'').toLowerCase().includes(q)));$('inventoryTable').innerHTML=tableHTML(items)}
function renderCustomerFinder(){
  const brand=$('customerBrand')?.value||'',specs=$('customerSpecs')?.value||'',bt=$('customerBudget')?.value||'',budget=bt===''?null:Number(bt);
  const items=laptops.filter(x=>{
    if(x.status!=='In Stock')return false;
    if(brand&&String(x.brand||'')!==brand)return false;
     if(specs&&String(x.specs||'')!==specs)return false;
    const price=Number(x.sellingPrice)||0;
    if(budget!==null&&(!Number.isFinite(budget)||budget<0||!price||price>budget))return false;
    return true;
  }).sort((a,b)=>String(a.brand||'').localeCompare(String(b.brand||''))||String(a.model||'').localeCompare(String(b.model||'')));
  $('customerCount').textContent=`${items.length} available in-stock laptop(s) found`;
  $('customerResults').innerHTML=items.length?`<div class="tablewrap"><table class="customer-table"><thead><tr><th>Brand</th><th>Model</th><th>Specifications</th><th>Price</th><th>Availability</th></tr></thead><tbody>${items.map(x=>`<tr><td>${esc(x.brand||'—')}</td><td>${esc(x.model||'—')}</td><td>${esc(x.specs||'Not specified')}</td><td><strong>${Number(x.sellingPrice)>0?money(x.sellingPrice):'Contact for price'}</strong></td><td>${statusPill('In Stock')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No in-stock laptops match these filters. Try another brand, specification or budget.</div>';
}
function renderReports(){const brands={};laptops.forEach(x=>{const b=x.brand||'Unknown';if(!brands[b])brands[b]={total:0,stock:0,value:0,dent:0};brands[b].total++;if(x.status==='In Stock'){brands[b].stock++;brands[b].value+=Number(x.purchasePrice)||0}if(x.status==='Dent')brands[b].dent++});const rows=Object.entries(brands).sort().map(([b,v])=>`<tr><td>${esc(b)}</td><td>${v.total}</td><td>${v.stock}</td><td>${v.dent}</td><td>${money(v.value)}</td></tr>`);$('brandReport').innerHTML=rows.length?`<div class="tablewrap"><table><thead><tr><th>Brand</th><th>Total Laptops</th><th>In Stock</th><th>Dent</th><th>Stock Value</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`:'<div class="empty">No records to report yet.</div>'}
function renderStockInForm(){$('stockInForm').innerHTML=`<form id="quickIn" class="formgrid"><div class="field"><label>Serial Number *</label><input name="serial" required></div><div class="field"><label>Brand *</label><input name="brand" list="brandOptions" required></div><div class="field"><label>Processor Generation</label><input name="generation" list="generationOptions"></div><div class="field"><label>Model *</label><input name="model" required></div><div class="field"><label>Specifications</label><input name="specs" list="specsOptions"></div><div class="field"><label>Purchase Cost (₹) *</label><input name="purchasePrice" type="number" min="0" step=".01" required></div><div class="field"><label>Received Date *</label><input name="purchaseDate" type="date" value="${todayISO()}" required></div><div class="field"><label>Supplier</label><input name="supplier"></div><div class="field"><label>Invoice No.</label><input name="invoice"></div><div class="formactions"><button type="submit" class="primary">＋ Record Stock In</button></div></form>`;$('quickIn').addEventListener('submit',e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target).entries());v.serial=v.serial.trim().toUpperCase();if(laptops.some(x=>String(x.serial).toUpperCase()===v.serial)){alert('Serial number already exists.');return}laptops.unshift({id:uid(),...v,purchasePrice:Number(v.purchasePrice),status:'In Stock',holder:'',sellingPrice:'',movementDate:'',warranty:'',notes:'',enquiry:'',createdAt:new Date().toISOString()});saveData();renderStockInForm();alert('Stock-in entry saved.')})}
function renderStockOutForm(){const eligible=laptops.filter(x=>['In Stock','Dent','Repair'].includes(x.status));$('stockOutForm').innerHTML=eligible.length?`<form id="quickOut" class="formgrid"><div class="field"><label>Laptop Serial Number *</label><select name="serial" required><option value="">Select laptop</option>${eligible.map(x=>`<option value="${esc(x.serial)}">${esc(x.serial)} — ${esc(x.brand)} ${esc(x.model)} (${esc(x.status)})</option>`).join('')}</select></div><div class="field"><label>Movement Type / Status *</label><select name="status" required>${STATUSES.map(s=>`<option>${esc(s)}</option>`).join('')}</select></div><div class="field"><label>Customer / Staff / Repair Vendor</label><input name="holder"></div><div class="field"><label>Issue / Status Date *</label><input name="movementDate" type="date" value="${todayISO()}" required></div><div class="field"><label>Selling Price (₹)</label><input name="sellingPrice" type="number" min="0" step=".01"></div><div class="field"><label>Notes / Damage Details</label><input name="notes" placeholder="e.g. dent on lid or corner"></div><div class="formactions"><button class="primary">Save Status Update</button></div></form>`:'<div class="empty">No laptops available for a status update.</div>';const form=$('quickOut');if(!form)return;form.addEventListener('submit',e=>{e.preventDefault();const v=Object.fromEntries(new FormData(form).entries()),x=laptops.find(y=>y.serial===v.serial);if(!x)return;x.status=v.status;x.holder=v.status==='In Stock'?'':v.holder.trim();x.movementDate=v.status==='In Stock'?'':v.movementDate;x.sellingPrice=v.status==='In Stock'||v.sellingPrice===''?'':Number(v.sellingPrice);if(v.notes.trim())x.notes=v.notes.trim();saveData();renderStockOutForm();renderOutTable();alert('Laptop status updated.')})}
function renderOutTable(){$('outTable').innerHTML=tableHTML(laptops.filter(x=>['Dispatched','Issued','Sold','Repair','Replacement','Dent'].includes(x.status)))}
function refreshChallanLaptopOptions(){const el=$('dcLaptop');if(!el)return;const old=el.value;el.innerHTML='<option value="">Select laptop (In Stock only can be dispatched)</option>'+laptops.map(x=>`<option value="${escAttr(x.id)}" ${x.status==='In Stock'?'':'disabled'}>${esc(x.brand)} ${esc(x.model)} — ${esc(x.serial)} (${esc(x.status)}${x.status==='In Stock'?' · Available':' · Not available'})</option>`).join('');if(laptops.some(x=>x.id===old))el.value=old}
function fillChallanLaptop(){const x=laptops.find(item=>item.id===$('dcLaptop').value);if(!x){$('dcDescription').value='';$('dcSerial').value='';$('dcStatus').value='';$('dcRate').value='0';return}$('dcSerial').value=x.serial||'';$('dcStatus').value=x.status||'Unknown';$('dcDescription').value=[x.brand,x.model,x.generation,x.specs].filter(Boolean).join(' ');$('dcRate').value=Number(x.sellingPrice)>0?x.sellingPrice:'0'}
function resetDeliveryChallan(){ $('dcNumber').value='DC-02333';$('dcDate').value=todayISO();$('dcCustomer').value='';$('dcAddress').value='';$('dcLaptop').value='';$('dcDescription').value='';$('dcSerial').value='';$('dcStatus').value='';$('dcShipment').value='';$('dcQty').value='1';$('dcRate').value='0'; }
function printDeliveryChallan(){const number=$('dcNumber').value.trim(),customerRecord=customers.find(x=>x.id===$('dcCustomer').value),customer=customerRecord?.name||'',customerAddress=customerRecord?.address||$('dcAddress').value.trim(),date=$('dcDate').value;if(!number||!customer||!date){alert('Please enter DC number and challan date, and select a customer from Customer Management.');return}if(!customerAddress){alert('The selected customer has no saved address. Please update the address in Customer Management.');return}const qty=Math.max(1,Number($('dcQty').value)||1),rate=Math.max(0,Number($('dcRate').value)||0),amount=qty*rate,fmt=n=>new Intl.NumberFormat('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n),dateText=new Date(date+'T00:00:00').toLocaleDateString('en-GB'),words=amount===0?'Indian Rupee Zero Only':'Indian Rupees '+numberToWords(Math.round(amount))+' Only',description=$('dcDescription').value.trim()||'Laptop / Computer',serial=$('dcSerial').value.trim(),status=$('dcStatus').value.trim(),shipment=$('dcShipment').value.trim(),terms=$('dcTerms').value.trim().split('\n').map(esc).join('<br>');const w=window.open('','_blank','width=1000,height=800');if(!w){alert('Please allow pop-ups to print the challan.');return}w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Delivery Challan ${esc(number)}</title><style>*{box-sizing:border-box}body{margin:0;background:#f5f5f5;color:#111;font:12px Georgia,'Times New Roman',serif}.page{width:794px;min-height:1123px;margin:16px auto;background:white;padding:70px 62px 50px;position:relative;box-shadow:0 0 5px #ccc}.ribbon{position:absolute;top:18px;left:-2px;background:#95a6a7;color:#fff;padding:10px 35px;transform:rotate(-45deg) translate(-18px,-20px);font:12px Arial}.head{display:flex;justify-content:space-between;min-height:150px}.dc-brand{display:flex;align-items:center;gap:12px;margin-bottom:12px}.dc-mark{width:56px;height:56px;display:block;object-fit:contain;background:#fff;border:0;border-radius:0;flex-shrink:0}.dc-brand-name{font:bold 21px Arial,sans-serif;color:#172a43;letter-spacing:.2px}.dc-brand-sub{font:10px Arial,sans-serif;color:#1769e8;letter-spacing:2px;margin-top:4px}.company{line-height:1.65}.title{text-align:right;font-size:16px}.dcno{text-align:right;font-weight:bold;margin-top:8px}.deliver{display:flex;justify-content:space-between;margin:10px 0 24px;align-items:end}.blue{color:#1769e8;font-weight:bold;margin-top:8px}.date{display:flex;gap:55px;white-space:nowrap}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#3e403e;color:#fff;text-align:left;padding:10px 9px}td{padding:13px 9px;border-bottom:1px solid #aaa;vertical-align:top}.num,.qty,.rate,.amount{text-align:right;white-space:nowrap}.totals{width:50%;margin:0 0 0 auto}.totals td{border:0;padding:10px}.total{background:#f2f2f2;font-weight:bold}.words{text-align:right;margin:15px 0}.signature-note{text-align:center;margin-top:82px;line-height:1.7}.terms{margin-top:34px;line-height:1.7;max-width:440px;white-space:normal}.terms-title{font-size:14px;margin-bottom:8px}.auth{margin-top:35px}.line{display:inline-block;border-bottom:1px solid #111;width:200px;vertical-align:middle}.printbtn{margin:18px auto;display:block;padding:10px 18px}@media print{body{background:white}.page{margin:0;width:100%;min-height:100vh;box-shadow:none;padding:70px 62px 40px}.printbtn{display:none}@page{size:A4;margin:0}}</style></head><body><div class="page"><div class="ribbon">Draft</div><div class="head"><div class="company"><div class="dc-brand"><img class="dc-mark" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAAcCAIAAABztQG/AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEXSURBVEhL7ZTZFcQgCEVTlwVZj9XYjMVkUBEw6GiWk/kY358RuazZ9t9psd/XYvcUvLPGbFLGWBfw+oYG7OBtZFmfUMGJGKxPFjf0nQ0wkKQUfPXxoobsBHqiwlqjfnOez/PHs4Y9zwHkvtfSwzg5i8O8vas91/WHuPDOOB8ChznTpz47ADP6sOA0HSkAGjP6xiCETyXeZlOXpQfOCeEN9Cm12AVyXCOClwsO8dLCaXYhqGRaaXK/s05VQLGn0XxuTv+EjmxV16I6JjITdjic+mlPXXaVd9md8idtoKkM83VXNZc+8nJhS2Vp2QjgsNbi0YkG6FmLnqsBin8p7fBglMwgDLydUov9lhYb2/aE0ONI/1nzff8A+xmBwRrjm5MAAAAASUVORK5CYII=" alt="Dos Electronics logo"><div><div class="dc-brand-name">Dos Electronics</div><div class="dc-brand-sub">YOUR TECH PARTNER</div></div></div>#874/1, 19TH MAIN, BANASHANKARI II STAGE<br>BANGALORE, Karnataka 560070<br>GSTIN 29ABPPC7860A1ZM</div><div><div class="title">DELIVERY CHALLAN</div><div class="dcno">DC no : ${esc(number)}</div></div></div><div class="deliver"><div style="max-width:60%">Deliver To<div class="blue">${esc(customer)}</div><div style="margin-top:7px;white-space:pre-line;line-height:1.5">${esc(customerAddress)}</div></div><div class="date"><span>Challan Date :</span><span>${esc(dateText)}</span></div></div><table><thead><tr><th style="width:7%">#</th><th>Item &amp; Description</th><th class="qty">Qty</th><th class="rate">Rate</th><th class="amount">Amount</th></tr></thead><tbody><tr><td>1</td><td>${esc(description)}${serial?'<br><br>S/N: '+esc(serial):''}${status?'<br>Status: '+esc(status):''}</td><td class="qty">${qty.toFixed(2)}</td><td class="rate">${fmt(rate)}</td><td class="amount">${fmt(amount)}</td></tr></tbody></table><table class="totals"><tr><td>Sub Total</td><td class="amount">${fmt(amount)}</td></tr><tr class="total"><td style="text-align:right">Total</td><td class="amount">₹${fmt(amount)}</td></tr></table><div class="words">Total In Words: &nbsp; <b><i>${esc(words)}</i></b></div><div style="margin-top:12px;font:12px Arial,sans-serif"><b>Laptop Status:</b> ${status?esc(status):'—'} &nbsp; | &nbsp; <b>Shipment Details:</b> ${shipment?esc(shipment):'—'}</div><div class="signature-note">Customer Signature<br>Please sign on the Delivery challan and send image of that on whatsapp</div><div class="terms"><div class="terms-title">Terms &amp; Conditions</div>${terms}</div><div class="auth">Authorized Signature <span class="line"></span></div></div><button class="printbtn" onclick="window.print()">Print / Save as PDF</button></body></html>`);w.document.close()}
function numberToWords(num){if(!num)return 'Zero';const a=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'],b=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];function under(n){if(n<20)return a[n];if(n<100)return b[Math.floor(n/10)]+(n%10?' '+a[n%10]:'');if(n<1000)return a[Math.floor(n/100)]+' Hundred'+(n%100?' '+under(n%100):'');return ''}let out=[];for(const [v,label] of [[10000000,'Crore'],[100000,'Lakh'],[1000,'Thousand'],[100,'Hundred']])if(num>=v){let q=Math.floor(num/v);out.push(under(q)+' '+label);num%=v}if(num)out.push(under(num));return out.join(' ')}
function renderAll(){refreshDynamicOptions();renderDashboard();renderInventory();if($('customerTable'))renderCustomers();if(currentRole==='employee'||!$('customerFinder').classList.contains('hidden'))renderCustomerFinder();if(!$('stockin').classList.contains('hidden'))renderStockInForm();if(!$('stockout').classList.contains('hidden')){renderStockOutForm();renderOutTable()}if(!$('reports').classList.contains('hidden'))renderReports();if(!$('employees').classList.contains('hidden'))renderEmployees();if(!$('couriers').classList.contains('hidden'))renderCouriers();if(!$('payroll').classList.contains('hidden')){renderPayrollEmployees();renderPayroll()}}
function showView(id){if(!currentRole)return;if(currentRole==='employee'&&id!=='customerFinder')return;document.querySelectorAll('.view').forEach(x=>x.classList.add('hidden'));$(id).classList.remove('hidden');document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.view===id));$('laptopFormSection').classList.add('hidden');if(id==='stockin')renderStockInForm();if(id==='challan'){refreshChallanLaptopOptions();refreshCustomerDropdown();if(!$('dcDate').value)$('dcDate').value=todayISO()}if(id==='quotation'){refreshQuotationCustomers();renderQuotationRegister();if(!$('qNumber').value)resetQuotation()}if(id==='customers')renderCustomers();if(id==='stockout'){renderStockOutForm();renderOutTable()}if(id==='reports')renderReports();if(id==='dashboard')renderDashboard();if(id==='inventory')renderInventory();if(id==='customerFinder'){refreshDynamicOptions();renderCustomerFinder()}if(id==='employees')renderEmployees();if(id==='couriers')renderCouriers();if(id==='payroll'){renderPayrollEmployees();renderPayroll()}}
document.querySelectorAll('.nav').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginMessage').textContent='Connecting to database…';if(!supabaseClient){$('loginMessage').textContent='Supabase is not configured. Add your Project URL and Publishable key in app.js, then upload the file again.';return}const email=$('loginUsername').value.trim(),password=$('loginPassword').value;try{const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});if(error)throw error;await finishSupabaseLogin(data.user)}catch(err){console.error(err);$('loginMessage').textContent=err.message||'Sign-in failed. Check your email, password, and Supabase setup.'}});
async function logout(){remoteSyncEnabled=false;currentRole=null;if(supabaseClient)await supabaseClient.auth.signOut();$('appShell').classList.add('hidden');$('loginPage').classList.remove('hidden');$('loginForm').reset();$('loginMessage').textContent=''}
function openForm(id=null){if(currentRole!=='admin')return;editingId=id;const item=laptops.find(x=>x.id===id);$('laptopFormSection').classList.remove('hidden');$('formTitle').textContent=item?'Edit Laptop':'Add New Laptop';$('formMessage').textContent='';$('laptopForm').reset();$('purchaseDate').value=todayISO();refreshDynamicOptions();if(item)FIELDS.forEach(k=>{if($(k))$(k).value=item[k]??''});$('laptopFormSection').scrollIntoView({behavior:'smooth',block:'start'})}
function closeForm(){$('laptopFormSection').classList.add('hidden');editingId=null}
function resetForm(){$('laptopForm').reset();$('purchaseDate').value=todayISO()}
$('laptopForm').addEventListener('submit',e=>{e.preventDefault();if(currentRole!=='admin')return;const v={};FIELDS.forEach(k=>v[k]=$(k).value.trim());v.serial=v.serial.toUpperCase();v.purchasePrice=Number(v.purchasePrice);v.sellingPrice=v.sellingPrice===''?'':Number(v.sellingPrice);if(!STATUSES.includes(v.status)){alert('Please select a valid status.');return}if(laptops.some(x=>String(x.serial).toUpperCase()===v.serial&&x.id!==editingId)){alert('This serial number already exists. Each laptop must have a unique serial number.');return}if(['Sold','Issued'].includes(v.status)&&!v.holder&&!confirm('No customer/staff name entered. Save anyway?'))return;if(v.status==='In Stock'){v.holder='';v.movementDate='';v.sellingPrice=''}if(editingId)laptops=laptops.map(x=>x.id===editingId?{...x,...v}:x);else laptops.unshift({id:uid(),createdAt:new Date().toISOString(),...v});saveData();closeForm();showView('dashboard')});
function deleteLaptop(id){if(currentRole!=='admin')return;const x=laptops.find(y=>y.id===id);if(x&&confirm(`Delete laptop ${x.serial}? Download a backup first if needed.`)){laptops=laptops.filter(y=>y.id!==id);saveData()}}
function csvCell(v){return '"'+String(v??'').replace(/"/g,'""')+'"'}function download(name,content,type='text/plain;charset=utf-8'){const blob=new Blob(['\ufeff',content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function exportCSV(){const csv=[HEADERS,...laptops.map(x=>FIELDS.map(k=>x[k]??''))].map(r=>r.map(csvCell).join(',')).join('\r\n');download('laptop-stock-register.csv',csv,'text/csv;charset=utf-8')}
function parseCSV(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++}else if(c==='"')quoted=false;else cell+=c}else if(c==='"')quoted=true;else if(c===','){row.push(cell);cell=''}else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell=''}else cell+=c}if(cell.length||row.length){row.push(cell.replace(/\r$/,''));rows.push(row)}return rows}
function importCSV(e){if(currentRole!=='admin'){e.target.value='';return}const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const rows=parseCSV(String(reader.result).replace(/^\ufeff/,'')),imported=rows.slice(1).filter(r=>r.some(v=>v.trim())).map(r=>{const x={};FIELDS.forEach((k,i)=>x[k]=r[i]??'');x.serial=x.serial.trim().toUpperCase();x.purchasePrice=Number(x.purchasePrice)||0;x.sellingPrice=x.sellingPrice===''?'':Number(x.sellingPrice);x.status=STATUSES.includes(x.status)?x.status:'In Stock';x.id=uid();return x}).filter(x=>x.serial);let added=0,skipped=0;for(const x of imported){if(laptops.some(y=>String(y.serial).toUpperCase()===x.serial)){skipped++;continue}laptops.unshift(x);added++}saveData();alert(`Import complete. Added: ${added}. Skipped duplicate serial numbers: ${skipped}.`)}catch{alert('Could not import this CSV. Use a CSV exported from this app.')}e.target.value=''};reader.readAsText(file)}
function backupJSON(){let deliveryChallans=[];try{deliveryChallans=JSON.parse(localStorage.getItem('dosElectronicsDeliveryChallans_v1')||'[]')}catch{}download('dos-electronics-full-backup.json',JSON.stringify({app:'Dos Electronics Office App',version:6,exportedAt:new Date().toISOString(),laptops,customers,employees,couriers,payrolls,quotations,replacements,deliveryChallans},null,2),'application/json')}
function restoreJSON(e){if(currentRole!=='admin'){e.target.value='';return}const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{const data=JSON.parse(r.result),arr=Array.isArray(data)?data:data.laptops;if(!Array.isArray(arr))throw Error('Invalid backup');if(!confirm(`Replace current ${laptops.length} records with ${arr.length} backup records?`)){e.target.value='';return}const seen=new Set();laptops=arr.filter(x=>{const s=String(x.serial||'').trim().toUpperCase();if(!s||seen.has(s))return false;seen.add(s);return true}).map(x=>({...x,id:x.id||uid(),serial:String(x.serial).trim().toUpperCase(),status:STATUSES.includes(x.status)?x.status:'In Stock'}));if(Array.isArray(data.employees)){employees=data.employees;writeStore(EMP_KEY,employees)}if(Array.isArray(data.couriers)){couriers=data.couriers;writeStore(COURIER_KEY,couriers)}if(Array.isArray(data.payrolls)){payrolls=data.payrolls;writeStore(PAYROLL_KEY,payrolls)}if(Array.isArray(data.quotations)){quotations=data.quotations;writeStore(QUOTE_KEY,quotations)}if(Array.isArray(data.customers)){customers=data.customers;writeStore(CUSTOMER_KEY,customers)}if(Array.isArray(data.replacements)){replacements=data.replacements;writeStore(REPLACEMENT_KEY,replacements)}if(Array.isArray(data.deliveryChallans)){writeStore('dosElectronicsDeliveryChallans_v1',data.deliveryChallans)}saveData();renderCustomers();refreshCustomerDropdown();renderReplacementModule();if(typeof renderQuotationRegister==='function')renderQuotationRegister();if(typeof renderQuotationTable==='function')renderQuotationTable();if(typeof renderChallanTable==='function')renderChallanTable();alert('Backup restored.')}catch{alert('Invalid backup file.')}e.target.value=''};r.readAsText(file)}
function clearAll(){if(currentRole!=='admin')return;if(confirm('Delete ALL laptop records saved in this browser?')&&confirm('Final confirmation: this cannot be undone without a backup.')){laptops=[];saveData();renderReports()}}
// Employee management (saved in this browser, separate from laptop records)
function resetEmployeeForm(){ $('employeeForm').reset();$('employeeEditId').value='';$('employeeFormTitle').textContent='Add Employee';$('employeeActive').value='Active'; }
$('employeeForm').addEventListener('submit',e=>{e.preventDefault();if(currentRole!=='admin')return;const id=$('employeeEditId').value,code=$('employeeCode').value.trim().toUpperCase();if(employees.some(x=>String(x.code).toUpperCase()===code&&x.id!==id)){alert('Employee ID already exists.');return}const item={id:id||makeId('EMP'),code,name:$('employeeName').value.trim(),phone:$('employeePhone').value.trim(),designation:$('employeeDesignation').value.trim(),joinDate:$('employeeJoinDate').value,salary:Number($('employeeSalary').value)||0,bank:$('employeeBank').value.trim(),status:$('employeeActive').value};employees=id?employees.map(x=>x.id===id?item:x):[item,...employees];if(writeStore(EMP_KEY,employees)){resetEmployeeForm();renderEmployees();renderPayrollEmployees()}});
function editEmployee(id){const x=employees.find(y=>y.id===id);if(!x)return;$('employeeEditId').value=x.id;$('employeeCode').value=x.code||'';$('employeeName').value=x.name||'';$('employeePhone').value=x.phone||'';$('employeeDesignation').value=x.designation||'';$('employeeJoinDate').value=x.joinDate||'';$('employeeSalary').value=x.salary||0;$('employeeBank').value=x.bank||'';$('employeeActive').value=x.status||'Active';$('employeeFormTitle').textContent='Edit Employee';$('employeeForm').scrollIntoView({behavior:'smooth'})}
function deleteEmployee(id){if(confirm('Delete this employee? Existing saved payslips will remain.')){employees=employees.filter(x=>x.id!==id);writeStore(EMP_KEY,employees);renderEmployees();renderPayrollEmployees()}}
function renderEmployees(){if(!$('employeeTable'))return;const q=($('employeeSearch')?.value||'').toLowerCase();const rows=employees.filter(x=>[x.code,x.name,x.phone,x.designation,x.status].join(' ').toLowerCase().includes(q));$('employeeTable').innerHTML=rows.length?'<div class="tablewrap"><table><thead><tr><th>Employee ID</th><th>Name</th><th>Phone</th><th>Designation</th><th>Monthly Salary</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+rows.map(x=>`<tr><td>${esc(x.code)}</td><td>${esc(x.name)}</td><td>${esc(x.phone||'—')}</td><td>${esc(x.designation||'—')}</td><td>${safeMoney(x.salary)}</td><td>${esc(x.status||'Active')}</td><td><div class="actions"><button class="light" onclick="editEmployee('${escAttr(x.id)}')">Edit</button><button class="danger" onclick="deleteEmployee('${escAttr(x.id)}')">Delete</button></div></td></tr>`).join('')+'</tbody></table></div>':'<div class="empty">No employees yet. Add the first employee above.</div>'}
// Manual courier register and update history
function resetCourierForm(){$('courierForm').reset();$('courierEditId').value='';$('courierFormTitle').textContent='Add Courier Shipment';$('courierDispatchDate').value=todayISO();$('courierStatus').value='Booked'}
$('courierForm').addEventListener('submit',e=>{e.preventDefault();if(currentRole!=='admin')return;const id=$('courierEditId').value,tracking=$('courierTracking').value.trim();const existing=couriers.find(x=>String(x.tracking).toLowerCase()===tracking.toLowerCase()&&x.id!==id);if(existing&&!confirm('This tracking number already exists. Save another shipment anyway?'))return;const old=couriers.find(x=>x.id===id);const item={id:id||makeId('CR'),company:$('courierCompany').value.trim(),tracking,recipient:$('courierRecipient').value.trim(),phone:$('courierPhone').value.trim(),dispatchDate:$('courierDispatchDate').value,expectedDate:$('courierExpectedDate').value,status:$('courierStatus').value,notes:$('courierNotes').value.trim(),history:old?.history||[]};item.history.push({date:new Date().toISOString(),status:item.status,notes:item.notes||'Shipment details saved'});couriers=id?couriers.map(x=>x.id===id?item:x):[item,...couriers];if(writeStore(COURIER_KEY,couriers)){resetCourierForm();renderCouriers()}});
function editCourier(id){const x=couriers.find(y=>y.id===id);if(!x)return;$('courierEditId').value=x.id;$('courierCompany').value=x.company||'';$('courierTracking').value=x.tracking||'';$('courierRecipient').value=x.recipient||'';$('courierPhone').value=x.phone||'';$('courierDispatchDate').value=x.dispatchDate||'';$('courierExpectedDate').value=x.expectedDate||'';$('courierStatus').value=x.status||'Booked';$('courierNotes').value=x.notes||'';$('courierFormTitle').textContent='Update Courier Shipment';$('courierForm').scrollIntoView({behavior:'smooth'})}
function courierHistory(id){const x=couriers.find(y=>y.id===id);if(!x)return;const h=(x.history||[]).map(v=>new Date(v.date).toLocaleString('en-IN')+' — '+v.status+(v.notes?' — '+v.notes:'')).join('\n');alert('Tracking history: '+(h||'No history'))}
function deleteCourier(id){if(confirm('Delete this shipment record?')){couriers=couriers.filter(x=>x.id!==id);writeStore(COURIER_KEY,couriers);renderCouriers()}}
function renderCouriers(){if(!$('courierTable'))return;const q=($('courierSearch')?.value||'').toLowerCase();const rows=couriers.filter(x=>[x.company,x.tracking,x.recipient,x.phone,x.status].join(' ').toLowerCase().includes(q));$('courierTable').innerHTML=rows.length?'<div class="tablewrap"><table><thead><tr><th>Courier</th><th>Tracking / AWB</th><th>Recipient</th><th>Dispatch</th><th>Expected</th><th>Status</th><th>Latest Notes</th><th>Actions</th></tr></thead><tbody>'+rows.map(x=>`<tr><td>${esc(x.company)}</td><td>${esc(x.tracking)}</td><td>${esc(x.recipient)}</td><td>${esc(x.dispatchDate||'—')}</td><td>${esc(x.expectedDate||'—')}</td><td>${esc(x.status)}</td><td>${esc(x.notes||'—')}</td><td><div class="actions"><button class="light" onclick="editCourier('${escAttr(x.id)}')">Update</button><button class="light" onclick="courierHistory('${escAttr(x.id)}')">History</button><button class="danger" onclick="deleteCourier('${escAttr(x.id)}')">Delete</button></div></td></tr>`).join('')+'</tbody></table></div>':'<div class="empty">No courier shipments yet.</div>'}
// Payroll calculations and printable payslips
function renderPayrollEmployees(){if(!$('payEmployee'))return;const old=$('payEmployee').value;const active=employees.filter(x=>x.status!=='Inactive');$('payEmployee').innerHTML='<option value="">Select employee</option>'+active.map(x=>`<option value="${escAttr(x.id)}">${esc(x.code)} — ${esc(x.name)}</option>`).join('');if(active.some(x=>x.id===old))$('payEmployee').value=old;const emp=employees.find(x=>x.id===$('payEmployee').value);if(emp&&!$('payBasic').value)$('payBasic').value=emp.salary||0}
$('payEmployee').addEventListener('change',()=>{const x=employees.find(y=>y.id===$('payEmployee').value);$('payBasic').value=x?x.salary:0;calculatePayrollPreview()});['payBasic','payAllowances','payDeductions','payDays'].forEach(id=>$(id).addEventListener('input',calculatePayrollPreview));
function payrollAmounts(){let basic=Number($('payBasic').value)||0,allow=Number($('payAllowances').value)||0,deduct=Number($('payDeductions').value)||0,days=$('payDays').value;let paidBasic=basic;if(days!==''&&Number(days)<30)paidBasic=basic*Math.max(0,Number(days))/30;return {basic:paidBasic,allow,deduct,net:paidBasic+allow-deduct}}
function calculatePayrollPreview(){if(!$('payPreview'))return;const a=payrollAmounts();$('payPreview').textContent='Estimated net pay: '+safeMoney(a.net)}
$('payrollForm').addEventListener('submit',e=>{e.preventDefault();if(currentRole!=='admin')return;const emp=employees.find(x=>x.id===$('payEmployee').value);if(!emp){alert('Please add and select an employee first.');return}const month=$('payMonth').value;if(!month){alert('Select payroll month.');return}if(payrolls.some(x=>x.employeeId===emp.id&&x.month===month)&&!confirm('Payroll already exists for this employee and month. Save another record?'))return;const a=payrollAmounts();if(a.net<0&&!confirm('Net pay is negative. Save anyway?'))return;const item={id:makeId('PAY'),employeeId:emp.id,employeeCode:emp.code,employeeName:emp.name,designation:emp.designation||'',month,basic:a.basic,allowances:a.allow,deductions:a.deduct,net:a.net,paidDays:$('payDays').value||'',paymentDate:$('payDate').value,status:$('payStatus').value,createdAt:new Date().toISOString()};payrolls.unshift(item);if(writeStore(PAYROLL_KEY,payrolls)){renderPayroll();printPayslip(item.id)}});
function renderPayroll(){if(!$('payrollTable'))return;const month=$('payrollSearch')?.value||'';const rows=payrolls.filter(x=>!month||x.month===month);$('payrollTable').innerHTML=rows.length?'<div class="tablewrap"><table><thead><tr><th>Month</th><th>Employee</th><th>Basic Pay</th><th>Allowances</th><th>Deductions</th><th>Net Pay</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+rows.map(x=>`<tr><td>${esc(x.month)}</td><td>${esc(x.employeeName)} (${esc(x.employeeCode)})</td><td>${safeMoney(x.basic)}</td><td>${safeMoney(x.allowances)}</td><td>${safeMoney(x.deductions)}</td><td><strong>${safeMoney(x.net)}</strong></td><td>${esc(x.status)}</td><td><div class="actions"><button class="primary" onclick="printPayslip('${escAttr(x.id)}')">Print Payslip</button><button class="danger" onclick="deletePayroll('${escAttr(x.id)}')">Delete</button></div></td></tr>`).join('')+'</tbody></table></div>':'<div class="empty">No payroll records found for this month.</div>'}
function deletePayroll(id){if(confirm('Delete this payroll record?')){payrolls=payrolls.filter(x=>x.id!==id);writeStore(PAYROLL_KEY,payrolls);renderPayroll()}}
function printPayslip(id){const x=payrolls.find(y=>y.id===id);if(!x)return;const w=window.open('','_blank','width=800,height=900');if(!w){alert('Please allow pop-ups to print the payslip.');return}w.document.write(`<!doctype html><html><head><title>Payslip ${esc(x.employeeCode)} ${esc(x.month)}</title><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#172a43;margin:35px}h1{text-align:center}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{padding:12px;border:1px solid #dfe7f1;text-align:left}.total{font-size:20px;font-weight:bold}.muted{color:#65758b}.sign{display:flex;justify-content:space-between;margin-top:80px}@media print{button{display:none}}</style></head><body><h1><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAAcCAIAAABztQG/AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEXSURBVEhL7ZTZFcQgCEVTlwVZj9XYjMVkUBEw6GiWk/kY358RuazZ9t9psd/XYvcUvLPGbFLGWBfw+oYG7OBtZFmfUMGJGKxPFjf0nQ0wkKQUfPXxoobsBHqiwlqjfnOez/PHs4Y9zwHkvtfSwzg5i8O8vas91/WHuPDOOB8ChznTpz47ADP6sOA0HSkAGjP6xiCETyXeZlOXpQfOCeEN9Cm12AVyXCOClwsO8dLCaXYhqGRaaXK/s05VQLGn0XxuTv+EjmxV16I6JjITdjic+mlPXXaVd9md8idtoKkM83VXNZc+8nJhS2Vp2QjgsNbi0YkG6FmLnqsBin8p7fBglMwgDLydUov9lhYb2/aE0ONI/1nzff8A+xmBwRrjm5MAAAAASUVORK5CYII=" alt="Dos Electronics logo" style="width:48px;height:48px;object-fit:contain;vertical-align:middle;margin-right:10px">Dos Electronics</h1><p style="text-align:center">Salary Payslip — ${esc(x.month)}</p><hr><p><b>Employee:</b> ${esc(x.employeeName)}<br><b>Employee ID:</b> ${esc(x.employeeCode)}<br><b>Designation:</b> ${esc(x.designation||'—')}<br><b>Paid days:</b> ${esc(x.paidDays||'Full month')}<br><b>Payment date:</b> ${esc(x.paymentDate||'—')}</p><table><tr><th>Earnings</th><th>Amount</th></tr><tr><td>Basic salary (adjusted)</td><td>${safeMoney(x.basic)}</td></tr><tr><td>Allowances / incentives</td><td>${safeMoney(x.allowances)}</td></tr><tr><th>Total earnings</th><th>${safeMoney(Number(x.basic)+Number(x.allowances))}</th></tr><tr><td>Deductions</td><td>${safeMoney(x.deductions)}</td></tr><tr class="total"><th>Net salary</th><th>${safeMoney(x.net)}</th></tr></table><p><b>Payment status:</b> ${esc(x.status)}</p><div class="sign"><span>Employee signature: __________________</span><span>Authorised signature: __________________</span></div><p class="muted">Generated by Dos Electronics local office app.</p><button onclick="window.print()">Print / Save as PDF</button><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close()}
// Ensure modules are refreshed on first app load and are included in the full backup.

$('today').textContent=new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});if($('dcDate'))$('dcDate').value=todayISO();refreshChallanLaptopOptions();refreshCustomerDropdown();$('dcLaptop')?.addEventListener('change',fillChallanLaptop);refreshDynamicOptions();renderAll();if($('qTaxType'))$('qTaxType').addEventListener('change',renderQuotationTotals);

/* ===== Extracted from original inline script block ===== */

/* =========================================================
   DELIVERY CHALLAN EXTENSION
   Adds Ship To, saved challan register, view, print and delete.
   Keeps the existing login and other app modules unchanged.
   ========================================================= */
(function () {
  'use strict';

  const DC_KEY = 'dosElectronicsDeliveryChallans_v1';
  const $dc = id => document.getElementById(id);

  function readChallans() {
    try {
      const data = JSON.parse(localStorage.getItem(DC_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  function saveChallans(data) {
    try {
      localStorage.setItem(DC_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      alert('Could not save challan. Browser storage may be full.');
      return false;
    }
  }

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(
      /[&<>"']/g,
      c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[c]
    );
  }

  function currency(value) {
    return Number(value || 0).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    });
  }

  function addShipToField() {
    if (!$dc('dcShipment') || $dc('dcShipTo')) return;

    const shipmentField = $dc('dcShipment').closest('.field');
    const shipTo = document.createElement('div');

    shipTo.className = 'field';
    shipTo.innerHTML = `
      <label for="dcShipTo">Ship To</label>
      <textarea id="dcShipTo" rows="2"
        placeholder="Delivery address, recipient or destination"></textarea>
    `;

    if (shipmentField && shipmentField.parentNode) {
      shipmentField.insertAdjacentElement('afterend', shipTo);
    }
  }

  function addChallanTable() {
    if ($dc('createdChallanTable')) return;

    const section = $dc('challan');
    if (!section) return;

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="panelhead">
        <h2>Created Delivery Challans</h2>
        <div class="tools">
          <input id="dcTableSearch"
            placeholder="Search DC number, customer, Ship To..."
            aria-label="Search delivery challans">
          <button type="button" class="green"
            onclick="exportDeliveryChallans()">Export Challans CSV</button>
        </div>
      </div>
      <div id="createdChallanTable"></div>
      <p class="note">
        Created challans are saved in this browser. Download regular
        backups if you need to transfer records to another computer.
      </p>
    `;

    section.appendChild(panel);

    $dc('dcTableSearch').addEventListener('input', renderChallanTable);
  }

  function getFormData() {
    const customerId = $dc('dcCustomer').value;
    const customer = (customers || []).find(c => c.id === customerId);

    const quantity = Math.max(1, Number($dc('dcQty').value) || 1);
    const rate = Math.max(0, Number($dc('dcRate').value) || 0);

    return {
      id: 'DCREC-' + Date.now() + '-' +
        Math.random().toString(36).slice(2, 7),
      number: $dc('dcNumber').value.trim(),
      date: $dc('dcDate').value,
      customerId: customerId,
      customer: customer ? customer.name : '',
      address: customer ? (customer.address || '') : '',
      shipTo: $dc('dcShipTo').value.trim(),
      laptopId: $dc('dcLaptop').value,
      description: $dc('dcDescription').value.trim(),
      serial: $dc('dcSerial').value.trim(),
      status: $dc('dcStatus').value.trim(),
      shipment: $dc('dcShipment').value.trim(),
      quantity: quantity,
      rate: rate,
      amount: quantity * rate,
      terms: $dc('dcTerms').value,
      createdAt: new Date().toISOString()
    };
  }

  function renderChallanTable() {
    const host = $dc('createdChallanTable');
    if (!host) return;

    const query = ($dc('dcTableSearch')?.value || '')
      .trim().toLowerCase();

    const records = readChallans().filter(x =>
      [
        x.number, x.date, x.customer, x.shipTo,
        x.shipment, x.serial, x.description
      ].join(' ').toLowerCase().includes(query)
    );

    if (!records.length) {
      host.innerHTML =
        '<div class="empty">No delivery challans created yet.</div>';
      return;
    }

    host.innerHTML = `
      <div class="tablewrap">
        <table>
          <thead>
            <tr>
              <th>DC Number</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Ship To</th>
              <th>Shipment Details</th>
              <th>Item</th>
              <th>Quantity</th>
              <th>Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${records.map(x => `
              <tr>
                <td><strong>${escapeHTML(x.number)}</strong></td>
                <td>${escapeHTML(x.date)}</td>
                <td>${escapeHTML(x.customer)}</td>
                <td style="white-space:normal;min-width:180px">
                  ${escapeHTML(x.shipTo || '—')}
                </td>
                <td>${escapeHTML(x.shipment || '—')}</td>
                <td style="white-space:normal;min-width:150px">
                  ${escapeHTML(x.description || 'Laptop / Computer')}
                  ${x.serial ? '<br>S/N: ' + escapeHTML(x.serial) : ''}
                </td>
                <td>${escapeHTML(x.quantity)}</td>
                <td>${currency(x.amount)}</td>
                <td>
                  <div class="actions">
                    <button type="button" class="light"
                      onclick="viewDeliveryChallan('${escapeHTML(x.id)}')">
                      View
                    </button>
                    <button type="button" class="primary"
                      onclick="reprintDeliveryChallan('${escapeHTML(x.id)}')">
                      Print
                    </button>
                    <button type="button" class="danger"
                      onclick="deleteDeliveryChallan('${escapeHTML(x.id)}')">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Save the challan and update inventory exactly once. A selected physical laptop
  // must be in stock, and each serial-numbered laptop is dispatched individually.
  const originalPrint = window.printDeliveryChallan;
  window.printDeliveryChallan = function () {
    if (typeof originalPrint !== 'function') {
      alert('The original challan print function was not found.');
      return;
    }
    const number = $dc('dcNumber').value.trim();
    const date = $dc('dcDate').value;
    const customerId = $dc('dcCustomer').value;
    const customer = (customers || []).find(c => c.id === customerId);
    const address = customer && (customer.address || '').trim();
    const laptopId = $dc('dcLaptop').value;
    const laptop = (laptops || []).find(x => x.id === laptopId);
    const quantity = Math.max(1, Number($dc('dcQty').value) || 1);
    if (!number || !date || !customer) {
      alert('Please enter DC number and date, and select a customer from Customer Management.');
      return;
    }
    if (!address) {
      alert('The selected customer has no saved address. Please update the address in Customer Management.');
      return;
    }
    if (!laptopId || !laptop) {
      alert('Please select the physical laptop from the Laptop / Item dropdown so inventory can be updated.');
      return;
    }
    if (quantity !== 1) {
      alert('This challan is linked to one serial-numbered laptop. Set Quantity to 1. Create a separate challan line/record for each laptop serial number.');
      return;
    }
    const records = readChallans();
    const existing = records.find(x => String(x.number || '').toLowerCase() === number.toLowerCase());
    if (existing && !confirm('This DC number already exists. Update the saved challan with the current details?')) return;
    if (existing && existing.stockMovement && existing.stockMovement.applied && existing.stockMovement.laptopId === laptopId) {
      // Editing the same challan/laptop changes its details only; do not deduct twice.
      const record = getFormData();
      record.id = existing.id;
      record.createdAt = existing.createdAt;
      record.status = 'Dispatched';
      record.stockMovement = existing.stockMovement;
      const sameLaptop = laptops.find(x => x.id === laptopId);
      if (sameLaptop && sameLaptop.lastDeliveryChallanId === existing.id) {
        sameLaptop.status = 'Dispatched';
        sameLaptop.holder = customer.name || record.shipTo || 'Delivery Challan';
        sameLaptop.movementDate = date;
        if (!saveData()) return;
      }
      const updated = records.map(x => x.id === existing.id ? record : x);
      if (!saveChallans(updated)) return;
      renderChallanTable();
      $dc('dcStatus').value = 'Dispatched';
      originalPrint();
      return;
    }

    const oldLaptops = laptops.map(x => ({...x}));
    // If this challan is being changed to a different laptop, safely reverse its previous movement.
    if (existing && existing.stockMovement && existing.stockMovement.applied) {
      const oldItem = laptops.find(x => x.id === existing.stockMovement.laptopId);
      if (!oldItem || !['Dispatched','Issued'].includes(oldItem.status) || oldItem.lastDeliveryChallanId !== existing.id) {
        alert('This challan’s original laptop status has changed since dispatch. Review its inventory record before editing this challan.');
        return;
      }
      Object.assign(oldItem, {
        status: existing.stockMovement.previousStatus || 'In Stock',
        holder: existing.stockMovement.previousHolder || '',
        movementDate: existing.stockMovement.previousMovementDate || '',
        sellingPrice: existing.stockMovement.previousSellingPrice ?? '',
        lastDeliveryChallanId: ''
      });
    }
    const target = laptops.find(x => x.id === laptopId);
    if (!target || target.status !== 'In Stock') {
      alert('This laptop is not currently In Stock. Select an available laptop. Inventory has not been changed.');
      laptops = oldLaptops;
      return;
    }

    const record = getFormData();
    if (existing) {
      record.id = existing.id;
      record.createdAt = existing.createdAt;
    }
    record.status = 'Dispatched';
    record.stockMovement = {
      applied: true,
      laptopId: target.id,
      previousStatus: target.status,
      previousHolder: target.holder || '',
      previousMovementDate: target.movementDate || '',
      previousSellingPrice: target.sellingPrice ?? ''
    };
    target.status = 'Dispatched';
    target.holder = customer.name || record.shipTo || 'Delivery Challan';
    target.movementDate = date;
    target.lastDeliveryChallanId = record.id;

    if (!saveData()) {
      laptops = oldLaptops;
      try { localStorage.setItem(KEY, JSON.stringify(laptops)); } catch (e) {}
      return;
    }
    const updated = existing
      ? records.map(x => x.id === existing.id ? record : x)
      : [record, ...records];
    if (!saveChallans(updated)) {
      laptops = oldLaptops;
      try { localStorage.setItem(KEY, JSON.stringify(laptops)); renderAll(); } catch (e) {}
      return;
    }
    renderChallanTable();
    refreshChallanLaptopOptions();
    $dc('dcLaptop').value = laptopId;
    $dc('dcStatus').value = 'Dispatched';
    originalPrint();
    alert('Delivery challan saved. Inventory updated: ' + target.serial + ' is now Dispatched and no longer counted as available stock.');
  };

  window.viewDeliveryChallan = function (id) {
    const x = readChallans().find(r => r.id === id);
    if (!x) {
      alert('Challan record not found.');
      return;
    }

    alert(
      'DELIVERY CHALLAN DETAILS\n\n' +
      'DC Number: ' + x.number + '\n' +
      'Date: ' + x.date + '\n' +
      'Customer: ' + x.customer + '\n' +
      'Customer Address: ' + x.address + '\n' +
      'Ship To: ' + (x.shipTo || '—') + '\n' +
      'Shipment: ' + (x.shipment || '—') + '\n' +
      'Item: ' + (x.description || 'Laptop / Computer') + '\n' +
      'Serial Number: ' + (x.serial || '—') + '\n' +
      'Status: ' + (x.status || '—') + '\n' +
      'Quantity: ' + x.quantity + '\n' +
      'Rate: ' + currency(x.rate) + '\n' +
      'Amount: ' + currency(x.amount)
    );
  };

  window.reprintDeliveryChallan = function (id) {
    const x = readChallans().find(r => r.id === id);
    if (!x) {
      alert('Challan record not found.');
      return;
    }

    // Restore the saved values into the existing form, then use its
    // original print layout. Do not create a new saved challan.
    $dc('dcNumber').value = x.number || '';
    $dc('dcDate').value = x.date || '';
    $dc('dcCustomer').value = x.customerId || '';
    if (typeof fillChallanCustomer === 'function') {
      fillChallanCustomer();
    }
    $dc('dcShipTo').value = x.shipTo || '';
    $dc('dcLaptop').value = x.laptopId || '';

    if (typeof fillChallanLaptop === 'function') {
      fillChallanLaptop();
    }

    $dc('dcDescription').value = x.description || '';
    $dc('dcSerial').value = x.serial || '';
    $dc('dcStatus').value = x.status || '';
    $dc('dcShipment').value = x.shipment || '';
    $dc('dcQty').value = x.quantity || 1;
    $dc('dcRate').value = x.rate || 0;
    $dc('dcTerms').value = x.terms || '';

    if (typeof originalPrint === 'function') originalPrint();
  };

  window.deleteDeliveryChallan = function (id) {
    const x = readChallans().find(r => r.id === id);
    if (!x) return;

    if (!confirm('Delete delivery challan ' + x.number + '?')) return;

    const remaining = readChallans().filter(r => r.id !== id);
    if (x.stockMovement && x.stockMovement.applied) {
      const laptop = laptops.find(y => y.id === x.stockMovement.laptopId);
      if (laptop && ['Dispatched','Issued'].includes(laptop.status) && laptop.lastDeliveryChallanId === x.id) {
        const previous = {...laptop};
        Object.assign(laptop, {
          status: x.stockMovement.previousStatus || 'In Stock',
          holder: x.stockMovement.previousHolder || '',
          movementDate: x.stockMovement.previousMovementDate || '',
          sellingPrice: x.stockMovement.previousSellingPrice ?? '',
          lastDeliveryChallanId: ''
        });
        if (!saveData()) { Object.assign(laptop, previous); return; }
      } else if (!confirm('This laptop’s status has changed since the challan was saved. Delete the challan without automatically restoring stock?')) {
        return;
      }
    }
    if (saveChallans(remaining)) { renderChallanTable(); refreshChallanLaptopOptions(); }
  };

  window.exportDeliveryChallans = function () {
    const records = readChallans();
    if (!records.length) {
      alert('There are no delivery challans to export.');
      return;
    }

    const columns = [
      ['DC Number', 'number'],
      ['Date', 'date'],
      ['Customer', 'customer'],
      ['Customer Address', 'address'],
      ['Ship To', 'shipTo'],
      ['Shipment Details', 'shipment'],
      ['Item Description', 'description'],
      ['Serial Number', 'serial'],
      ['Status', 'status'],
      ['Quantity', 'quantity'],
      ['Rate', 'rate'],
      ['Amount', 'amount']
    ];

    const cell = v => '"' +
      String(v == null ? '' : v).replace(/"/g, '""') + '"';

    const csv = [
      columns.map(c => cell(c[0])).join(','),
      ...records.map(r => columns.map(c => cell(r[c[1]])).join(','))
    ].join('\r\n');

    const blob = new Blob(['\ufeff', csv], {
      type: 'text/csv;charset=utf-8'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dos-electronics-delivery-challans.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Extend the existing reset without changing its original behaviour.
  const originalReset = window.resetDeliveryChallan;
  window.resetDeliveryChallan = function () {
    if (typeof originalReset === 'function') originalReset();
    if ($dc('dcShipTo')) $dc('dcShipTo').value = '';
  };

  function initialize() {
    addShipToField();
    addChallanTable();
    renderChallanTable();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();

/* QUOTATION MODULE — added while retaining the existing application */
const QUOTE_KEY='dosElectronicsQuotations_v1';
let quotations=readStore(QUOTE_KEY,[]), quotationItems=[];
function quotationNextNumber(){let max=0;quotations.forEach(q=>{const m=String(q.number||'').match(/(\d+)$/);if(m)max=Math.max(max,Number(m[1]))});return 'DE/QTN/'+String(max+1).padStart(4,'0')}
function refreshQuotationCustomers(){const el=$('qCustomer');if(!el)return;const old=el.value;el.innerHTML='<option value="">Select customer</option>'+customers.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name))).map(c=>`<option value="${escAttr(c.id)}">${esc(c.name)}</option>`).join('');if(customers.some(c=>c.id===old))el.value=old}
function resetQuotation(){if(!$('qNumber'))return;$('qNumber').value=quotationNextNumber();$('qDate').value=todayISO();$('qCustomer').value='';$('qTaxType').value='intra';$('qNotes').value='Looking forward to your business.';$('qTerms').value='Warranty: Based on manufacturer\nPayment: 100% against delivery\nDelivery: Subject to availability';quotationItems=[{description:'',qty:1,rate:0}];refreshQuotationCustomers();renderQuotationItems()}
function addQuotationItem(){quotationItems.push({description:'',qty:1,rate:0});renderQuotationItems()}
function updateQuotationItem(i,k,v){if(!quotationItems[i])return;quotationItems[i][k]=k==='description'?v:Math.max(0,Number(v)||0);renderQuotationItems(i)}
function removeQuotationItem(i){quotationItems.splice(i,1);if(!quotationItems.length)quotationItems.push({description:'',qty:1,rate:0});renderQuotationItems()}
function quoteAmounts(){const subtotal=quotationItems.reduce((n,x)=>n+Math.max(0,Number(x.qty)||0)*Math.max(0,Number(x.rate)||0),0),type=$('qTaxType')?.value||'intra',tax=type==='none'?0:subtotal*.18;return {subtotal,cgst:type==='intra'?tax/2:0,sgst:type==='intra'?tax/2:0,igst:type==='inter'?tax:0,total:subtotal+tax}}
function renderQuotationItems(){const host=$('qItems');if(!host)return;host.innerHTML='<div class="tablewrap"><table><thead><tr><th>Sl No.</th><th>Item &amp; Description</th><th>Qty</th><th>Unit Price (₹)</th><th>Amount (₹)</th><th>Action</th></tr></thead><tbody>'+quotationItems.map((x,i)=>`<tr><td>${i+1}</td><td><input aria-label="Item description" value="${escAttr(x.description)}" oninput="updateQuotationItem(${i},'description',this.value)"></td><td><input type="number" min="1" step="1" value="${Number(x.qty)||1}" oninput="updateQuotationItem(${i},'qty',this.value)"></td><td><input type="number" min="0" step=".01" value="${Number(x.rate)||0}" oninput="updateQuotationItem(${i},'rate',this.value)"></td><td>${money((Number(x.qty)||0)*(Number(x.rate)||0))}</td><td><button type="button" class="danger" onclick="removeQuotationItem(${i})">Remove</button></td></tr>`).join('')+'</tbody></table></div>';renderQuotationTotals()}
function renderQuotationTotals(){const el=$('qTotals');if(!el)return;const a=quoteAmounts();el.innerHTML=`<div style="max-width:380px;margin-left:auto"><p>Sub Total: <b>${money(a.subtotal)}</b></p><p>CGST: <b>${money(a.cgst)}</b></p><p>SGST: <b>${money(a.sgst)}</b></p><p>IGST: <b>${money(a.igst)}</b></p><hr><h2>Total: ${money(a.total)}</h2><p><b>Total in Words:</b> Indian Rupees ${esc(numberToWords(Math.round(a.total)))} Only</p></div>`}
function saveQuotation(){if(currentRole!=='admin'){alert('Only an admin can save quotations.');return}const c=customers.find(x=>x.id===$('qCustomer').value);if(!c){alert('Please select a customer from Customer Management.');return}if(!quotationItems.some(x=>x.description.trim()&&Number(x.qty)>0)){alert('Add at least one item with description and quantity.');return}const number=$('qNumber').value||quotationNextNumber();if(quotations.some(q=>q.number===number)){alert('This quotation number already exists. Click New Quotation.');return}const q={id:makeId('QTN'),number,date:$('qDate').value||todayISO(),customerId:c.id,customerName:c.name,customerAddress:c.address||'',customerGSTIN:c.gstin||'',taxType:$('qTaxType').value,items:quotationItems.map(x=>({description:x.description.trim(),qty:Number(x.qty)||0,rate:Number(x.rate)||0})),notes:$('qNotes').value.trim(),terms:$('qTerms').value.trim(),amounts:quoteAmounts(),createdAt:new Date().toISOString()};quotations.unshift(q);if(!writeStore(QUOTE_KEY,quotations)){quotations.shift();return}renderQuotationRegister();alert('Quotation saved successfully.');resetQuotation()}
function renderQuotationRegister(){const host=$('qRegister');if(!host)return;const term=($('qSearch')?.value||'').trim().toLowerCase(),list=quotations.filter(q=>[q.number,q.customerName,q.date].join(' ').toLowerCase().includes(term));host.innerHTML=list.length?'<div class="tablewrap"><table><thead><tr><th>Quotation No.</th><th>Date</th><th>Customer</th><th>Total</th><th>Actions</th></tr></thead><tbody>'+list.map(q=>`<tr><td>${esc(q.number)}</td><td>${esc(q.date)}</td><td>${esc(q.customerName)}</td><td>${money(q.amounts?.total||0)}</td><td><div class="actions"><button type="button" class="light" onclick="printSavedQuotation('${escAttr(q.id)}')">Print</button><button type="button" class="danger" onclick="deleteQuotation('${escAttr(q.id)}')">Delete</button></div></td></tr>`).join('')+'</tbody></table></div>':'<div class="empty">No saved quotations yet.</div>'}
function deleteQuotation(id){if(currentRole!=='admin'||!confirm('Delete this quotation?'))return;const old=quotations;quotations=quotations.filter(q=>q.id!==id);if(writeStore(QUOTE_KEY,quotations))renderQuotationRegister();else quotations=old}
function printQuotation(){const c=customers.find(x=>x.id===$('qCustomer').value);if(!c){alert('Select a customer first.');return}printQuotationRecord({number:$('qNumber').value||quotationNextNumber(),date:$('qDate').value||todayISO(),customerName:c.name,customerAddress:c.address||'',customerGSTIN:c.gstin||'',items:quotationItems,notes:$('qNotes').value,terms:$('qTerms').value,amounts:quoteAmounts()})}
function printSavedQuotation(id){const q=quotations.find(x=>x.id===id);if(q)printQuotationRecord(q)}
function printQuotationRecord(q){const w=window.open('','_blank','width=1000,height=800');if(!w){alert('Please allow pop-ups to print the quotation.');return}const a=q.amounts||{subtotal:0,cgst:0,sgst:0,igst:0,total:0},fmt=n=>new Intl.NumberFormat('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n)||0),dt=q.date?new Date(q.date+'T00:00:00').toLocaleDateString('en-GB'):'';w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Quotation ${esc(q.number)}</title><style>*{box-sizing:border-box}body{font:12px Georgia,'Times New Roman',serif;color:#111}.page{width:700px;max-width:100%;margin:20px auto;border:1px solid #999;padding:16px}.head{display:flex;justify-content:space-between;align-items:center}.brand{display:flex;gap:12px;align-items:center}.logo{width:48px;height:48px;object-fit:contain;display:block;background:#fff}h1{font-size:27px;font-weight:400}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #999;padding:7px;text-align:left}th{background:#f1f1f1}.right{text-align:right}.totals{width:48%;margin-left:auto}.terms{margin-top:25px;line-height:1.6;white-space:pre-line}.sign{text-align:right;margin-top:50px}@media print{.page{width:100%;margin:0;border:0}@page{size:A4;margin:12mm}}</style></head><body><div class="page"><div class="head"><div><div class="brand"><img class="logo" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAAcCAIAAABztQG/AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAEXSURBVEhL7ZTZFcQgCEVTlwVZj9XYjMVkUBEw6GiWk/kY358RuazZ9t9psd/XYvcUvLPGbFLGWBfw+oYG7OBtZFmfUMGJGKxPFjf0nQ0wkKQUfPXxoobsBHqiwlqjfnOez/PHs4Y9zwHkvtfSwzg5i8O8vas91/WHuPDOOB8ChznTpz47ADP6sOA0HSkAGjP6xiCETyXeZlOXpQfOCeEN9Cm12AVyXCOClwsO8dLCaXYhqGRaaXK/s05VQLGn0XxuTv+EjmxV16I6JjITdjic+mlPXXaVd9md8idtoKkM83VXNZc+8nJhS2Vp2QjgsNbi0YkG6FmLnqsBin8p7fBglMwgDLydUov9lhYb2/aE0ONI/1nzff8A+xmBwRrjm5MAAAAASUVORK5CYII=" alt="Dos Electronics logo"><b style="font-size:18px">Dos Electronics</b></div><p>#874/1, 19th Main, Banashankari II Stage<br>Bangalore, Karnataka 560070<br>GSTIN 29ABPPC7860A1ZM</p></div><div><h1>Quotation</h1><b>${esc(q.number)}</b><br>Date: ${esc(dt)}</div></div><hr><b>To:</b> ${esc(q.customerName)}<br>${esc(q.customerAddress||'')}<br>GSTIN: ${esc(q.customerGSTIN||'—')}<table><thead><tr><th>Sl No.</th><th>Item &amp; Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead><tbody>${(q.items||[]).map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.description)}</td><td class="right">${Number(x.qty)||0}</td><td class="right">${fmt(x.rate)}</td><td class="right">${fmt((Number(x.qty)||0)*(Number(x.rate)||0))}</td></tr>`).join('')}</tbody></table><table class="totals"><tr><td>Sub Total</td><td class="right">${fmt(a.subtotal)}</td></tr><tr><td>CGST</td><td class="right">${fmt(a.cgst)}</td></tr><tr><td>SGST</td><td class="right">${fmt(a.sgst)}</td></tr><tr><td>IGST</td><td class="right">${fmt(a.igst)}</td></tr><tr><th>Total</th><th class="right">₹${fmt(a.total)}</th></tr></table><p><b>Total in Words:</b> Indian Rupees ${esc(numberToWords(Math.round(a.total)))} Only</p><div class="terms"><b>Notes</b><br>${esc(q.notes||'Looking forward to your business.')}<br><br><b>Terms &amp; Conditions</b><br>${esc(q.terms||'')}</div><div class="sign">Authorized Signature</div></div><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close()}
function initQuotationPage(){refreshQuotationCustomers();resetQuotation();renderQuotationRegister()}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',initQuotationPage)}else{initQuotationPage()}

/* ===== Extracted from original inline script block ===== */

/* REPLACEMENT MANAGEMENT — records both the outgoing laptop and the actual incoming unit. */
const REPLACEMENT_KEY = 'dosElectronicsReplacements_v1';
let replacements = readStore(REPLACEMENT_KEY, []);
function replacementEsc(v){return esc(v == null ? '' : v)}
function nextReplacementRef(){let n=0;replacements.forEach(x=>{const m=String(x.reference||'').match(/(\d+)$/);if(m)n=Math.max(n,Number(m[1]))});return 'REP-'+new Date().getFullYear()+'-'+String(n+1).padStart(4,'0')}
function refreshReplacementSerials(selected=''){
  const el=$('repOldSerial');if(!el)return;const old=el.value||selected;
  el.innerHTML='<option value="">Select old laptop</option>'+laptops.filter(x=>['In Stock','Repair','Dent','Replacement'].includes(x.status)).slice().sort((a,b)=>String(a.serial).localeCompare(String(b.serial))).map(x=>`<option value="${escAttr(x.serial)}">${esc(x.serial)} — ${esc(x.brand)} ${esc(x.model)} (${esc(x.status)})</option>`).join('');
  if(laptops.some(x=>x.serial===old))el.value=old;
  fillReplacementOldSummary();
}
function fillReplacementOldSummary(){const serial=$('repOldSerial')?.value,x=laptops.find(y=>y.serial===serial),host=$('repOldSummary');if(!host)return;host.innerHTML=x?`<strong>Old laptop:</strong> ${esc(x.brand)} ${esc(x.model)} · Serial ${esc(x.serial)} · Current status: ${statusPill(x.status)}<br><strong>Specifications:</strong> ${esc(x.specs||'Not specified')}`:'Select the old laptop serial number to see its current details.'}
function resetReplacementForm(){const f=$('replacementForm');if(!f)return;f.reset();$('replacementEditId').value='';$('replacementFormTitle').textContent='Record Replacement';$('repReference').value=nextReplacementRef();$('repDateSent').value=todayISO();$('repDateReceived').value='';$('repCondition').value='New';$('repStatus').value='Pending';$('repOldSerial').disabled=false;refreshReplacementSerials();}
function renderReplacementModule(){if(!$('replacementTable'))return;refreshReplacementSerials($('repOldSerial')?.value||'');renderReplacementTable();}
function renderReplacementTable(){const host=$('replacementTable');if(!host)return;const q=($('repSearch')?.value||'').trim().toLowerCase();const rows=replacements.filter(x=>[x.reference,x.supplier,x.oldSerial,x.oldModel,x.newSerial,x.newBrand,x.newModel,x.invoice,x.status,x.notes].join(' ').toLowerCase().includes(q));if(!rows.length){host.innerHTML='<div class="empty">No replacement records yet. Create a replacement entry above.</div>';return;}host.innerHTML='<div class="tablewrap"><table><thead><tr><th>Reference</th><th>Date Sent</th><th>Supplier</th><th>Old Laptop Sent</th><th>Replacement Received</th><th>Date Received</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+rows.map(x=>`<tr><td><strong>${esc(x.reference)}</strong></td><td>${esc(x.dateSent||'—')}</td><td>${esc(x.supplier||'—')}</td><td>${esc(x.oldSerial||'—')}<br>${esc(x.oldModel||'')}</td><td>${x.newSerial?esc(x.newSerial)+'<br>'+esc([x.newBrand,x.newModel].filter(Boolean).join(' ')):'—'}</td><td>${esc(x.dateReceived||'—')}</td><td>${statusPill(x.status)}</td><td><div class="actions">${x.status!=='Received'?`<button type="button" class="light" onclick="editReplacement('${escAttr(x.id)}')">Update</button>`:'<span class="note">Received</span>'}<button type="button" class="danger" onclick="deleteReplacement('${escAttr(x.id)}')">Delete</button></div></td></tr>`).join('')+'</tbody></table></div>'}
$('repOldSerial')?.addEventListener('change',fillReplacementOldSummary);
$('replacementForm')?.addEventListener('submit',e=>{
  e.preventDefault();if(currentRole!=='admin'){alert('Only an admin can save replacement records.');return;}
  const id=$('replacementEditId').value,existing=replacements.find(x=>x.id===id),reference=$('repReference').value.trim(),supplier=$('repSupplier').value.trim(),oldSerial=$('repOldSerial').value,dateSent=$('repDateSent').value,status=$('repStatus').value;
  if(!reference||!supplier||!oldSerial||!dateSent){alert('Enter reference number, supplier, old laptop serial and date sent.');return;}
  if(replacements.some(x=>String(x.reference).toLowerCase()===reference.toLowerCase()&&x.id!==id)){alert('Replacement reference number already exists.');return;}
  if(existing&&existing.oldSerial!==oldSerial){alert('The old laptop serial cannot be changed when updating an existing replacement.');return;}
  if(existing&&existing.status==='Received'){alert('This replacement has already been received. Create a new reference for any further correction; the received stock record will not be duplicated.');return;}
  const oldLaptop=laptops.find(x=>x.serial===oldSerial);if(!oldLaptop){alert('Old laptop record not found.');return;}
  if(!existing&&!['In Stock','Repair','Dent'].includes(oldLaptop.status)){alert('The old laptop must be In Stock, Repair or Dent status before it can be sent for replacement.');return;}
  const newSerial=$('repNewSerial').value.trim().toUpperCase(),newBrand=$('repNewBrand').value.trim(),newModel=$('repNewModel').value.trim(),newSpecs=$('repNewSpecs').value.trim(),dateReceived=$('repDateReceived').value,invoice=$('repInvoice').value.trim(),condition=$('repCondition').value,notes=$('repNotes').value.trim();
  if(status==='Received'&&(!newSerial||!newBrand||!newModel||!dateReceived)){alert('To mark the replacement Received, enter the received laptop serial number, brand, model and date received.');return;}
  if(status==='Received'&&laptops.some(x=>String(x.serial).toUpperCase()===newSerial&&x.id!==existing?.incomingLaptopId)){alert('The received laptop serial number already exists in Laptop Register. Use the correct unique serial number.');return;}
  const oldSnapshot=existing?.oldPrevious||{status:oldLaptop.status,holder:oldLaptop.holder||'',movementDate:oldLaptop.movementDate||'',sellingPrice:oldLaptop.sellingPrice??''};
  const record={id:id||makeId('REP'),reference,supplier,oldSerial,oldModel:[oldLaptop.brand,oldLaptop.model].filter(Boolean).join(' '),oldSpecs:oldLaptop.specs||'',dateSent,status,newSerial,newBrand,newModel,newSpecs,dateReceived,invoice,condition,notes,oldPrevious:oldSnapshot,incomingLaptopId:existing?.incomingLaptopId||'',createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  const oldLaptopBackup={...oldLaptop},laptopsBackup=laptops.map(x=>({...x}));
  if(!existing){oldLaptop.status='Replacement';oldLaptop.holder=supplier;oldLaptop.movementDate=dateSent;oldLaptop.notes=[oldLaptop.notes,`Sent for replacement ${reference}`].filter(Boolean).join(' | ');}else if(oldLaptop.status==='Replacement'){oldLaptop.holder=supplier;oldLaptop.movementDate=dateSent;}
  if(status==='Received'&&!record.incomingLaptopId){
    const incoming={id:uid(),serial:newSerial,brand:newBrand,generation:'',model:newModel,specs:newSpecs,enquiry:'Replacement',purchaseDate:dateReceived,purchasePrice:0,supplier,invoice,warranty:'',status:'In Stock',holder:'',sellingPrice:'',movementDate:'',notes:`Received as replacement for ${oldSerial}. Reference: ${reference}. Condition: ${condition}.${notes?' '+notes:''}`,createdAt:new Date().toISOString(),replacementReference:reference,replacementFromSerial:oldSerial};
    laptops.unshift(incoming);record.incomingLaptopId=incoming.id;
  }
  if(!saveData()){laptops=laptopsBackup;return;}
  const next=existing?replacements.map(x=>x.id===id?record:x):[record,...replacements];
  if(!writeStore(REPLACEMENT_KEY,next)){laptops=laptopsBackup;try{localStorage.setItem(KEY,JSON.stringify(laptops));renderAll()}catch(err){}return;}
  replacements=next;resetReplacementForm();renderReplacementModule();alert(status==='Received'?'Replacement saved. Incoming laptop '+newSerial+' has been added to stock.':'Replacement record saved. Old laptop '+oldSerial+' is marked Replacement.');
});
function editReplacement(id){const x=replacements.find(y=>y.id===id);if(!x)return;if(x.status==='Received'){alert('This replacement is already received; the incoming laptop is already in stock.');return;}$('replacementEditId').value=x.id;$('replacementFormTitle').textContent='Update Replacement';$('repReference').value=x.reference||'';$('repSupplier').value=x.supplier||'';refreshReplacementSerials(x.oldSerial);$('repOldSerial').value=x.oldSerial||'';$('repOldSerial').disabled=true;$('repDateSent').value=x.dateSent||todayISO();$('repNewSerial').value=x.newSerial||'';$('repNewBrand').value=x.newBrand||'';$('repNewModel').value=x.newModel||'';$('repNewSpecs').value=x.newSpecs||'';$('repDateReceived').value=x.dateReceived||'';$('repInvoice').value=x.invoice||'';$('repCondition').value=x.condition||'New';$('repStatus').value=x.status==='Rejected'?'Rejected':'Pending';$('repNotes').value=x.notes||'';fillReplacementOldSummary();$('replacementForm').scrollIntoView({behavior:'smooth',block:'start'});}
function deleteReplacement(id){const x=replacements.find(y=>y.id===id);if(!x)return;if(x.status==='Received'){alert('Received replacement records cannot be deleted here because the incoming laptop is already in stock. Use the laptop register and an audit correction if needed.');return;}if(!confirm('Delete replacement record '+x.reference+'? The old laptop status will be restored if it is still marked Replacement for this record.'))return;const old=laptops.find(y=>y.serial===x.oldSerial);if(old&&old.status==='Replacement'&&old.holder===x.supplier){old.status=x.oldPrevious?.status||'In Stock';old.holder=x.oldPrevious?.holder||'';old.movementDate=x.oldPrevious?.movementDate||'';old.sellingPrice=x.oldPrevious?.sellingPrice??'';old.notes=String(old.notes||'').replace(new RegExp('Sent for replacement '+String(x.reference).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?: \| )?'),'').trim();if(!saveData())return;}const next=replacements.filter(y=>y.id!==id);if(writeStore(REPLACEMENT_KEY,next)){replacements=next;resetReplacementForm();renderReplacementModule();}}
function exportReplacementsCSV(){if(!replacements.length){alert('No replacement records to export.');return;}const cols=['Reference','Supplier','Old Serial','Old Model','Date Sent','New Serial','New Brand','New Model','Specifications','Date Received','Invoice / RMA','Condition','Status','Notes'];const keys=['reference','supplier','oldSerial','oldModel','dateSent','newSerial','newBrand','newModel','newSpecs','dateReceived','invoice','condition','status','notes'];const csv=[cols,...replacements.map(x=>keys.map(k=>x[k]??''))].map(row=>row.map(csvCell).join(',')).join('\r\n');download('dos-electronics-replacements.csv',csv,'text/csv;charset=utf-8');}
// Keep replacement module current after the app's normal navigation.
document.querySelectorAll('.nav[data-view="replacement"]').forEach(b=>b.addEventListener('click',()=>renderReplacementModule()));


/* ===== SUPABASE SQL DATABASE CONNECTION =====
   app_records stores one JSON array per module. This is a migration-friendly bridge
   for the existing app. For simultaneous edits by many users, move to row-per-record
   tables/operations before relying on concurrent editing. */
const SUPABASE_COLLECTIONS = () => [
  { key: KEY, collection: 'laptops' },
  { key: CUSTOMER_KEY, collection: 'customers' },
  { key: EMP_KEY, collection: 'employees' },
  { key: COURIER_KEY, collection: 'couriers' },
  { key: PAYROLL_KEY, collection: 'payrolls' },
  { key: QUOTE_KEY, collection: 'quotations' },
  { key: REPLACEMENT_KEY, collection: 'replacements' },
  { key: 'dosElectronicsDeliveryChallans_v1', collection: 'delivery_challans' }
];
function showDatabaseMessage(message, isError=false){
  const el=$('dbSyncStatus');
  if(el){el.textContent=message;el.style.color=isError?'#b42318':'#08784e';}
  if(isError)console.error(message);
}
async function getCurrentUserRole(user){
  const {data,error}=await supabaseClient.from('user_roles').select('role,active').eq('user_id',user.id).maybeSingle();
  if(error)throw new Error('Cannot read user role. Check the user_roles table and RLS policies: '+error.message);
  if(!data||data.active!==true||!['admin','employee'].includes(data.role))throw new Error('Your account has no active Dos Electronics role. Ask the administrator to add your email in public.user_roles.');
  return data.role;
}
function safeReadArray(key){try{const v=JSON.parse(localStorage.getItem(key)||'null');return Array.isArray(v)?v:[]}catch{return []}}
async function loadCollectionsFromDatabase(){
  const defs=SUPABASE_COLLECTIONS();
  const {data:rows,error}=await supabaseClient.from('app_records').select('collection,record_id,data').eq('record_id','all');
  if(error)throw new Error('Could not read app_records. Check SQL policies: '+error.message);
  const byName=new Map((rows||[]).map(r=>[r.collection,r]));
  for(const def of defs){
    const row=byName.get(def.collection);
    if(row){localStorage.setItem(def.key,JSON.stringify(Array.isArray(row.data)?row.data:[]));}
    else {
      // If this browser already has records, seed only the missing module.
      const local=safeReadArray(def.key);
      if(local.length && currentRole==='admin') await upsertCollection(def.collection,local);
      else if(currentRole==='employee' && def.collection!=='laptops') localStorage.setItem(def.key,'[]');
      else if(!local.length) localStorage.setItem(def.key,'[]');
    }
  }
  // Refresh the application's in-memory arrays after the remote pull.
  laptops=loadData(); employees=readStore(EMP_KEY,[]); couriers=readStore(COURIER_KEY,[]);
  payrolls=readStore(PAYROLL_KEY,[]); customers=loadCustomers();
  quotations=readStore(QUOTE_KEY,[]); replacements=readStore(REPLACEMENT_KEY,[]);
}
async function upsertCollection(collection, data){
  if(!supabaseClient)throw new Error('Supabase is not configured.');
  if(currentRole!=='admin')throw new Error('Only an admin can upload or modify shared records.');
  const previous=remoteSyncQueues[collection]||Promise.resolve();
  const next=previous.catch(()=>{}).then(async()=>{
    const {error}=await supabaseClient.from('app_records').upsert({collection,record_id:'all',data,updated_at:new Date().toISOString()},{onConflict:'collection,record_id'});
    if(error)throw error;
  });
  remoteSyncQueues[collection]=next;
  await next;
}
function installStorageSync(){
  if(storageSyncInstalled)return;storageSyncInstalled=true;
  const originalSet=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
    originalSet.call(this,key,value);
    if(this!==window.localStorage||!remoteSyncEnabled||currentRole!=='admin')return;
    const def=SUPABASE_COLLECTIONS().find(x=>x.key===key);if(!def)return;
    try{const data=JSON.parse(value);if(!Array.isArray(data))return;
      upsertCollection(def.collection,data).then(()=>showDatabaseMessage('Saved to Supabase: '+def.collection)).catch(err=>showDatabaseMessage('Database save failed for '+def.collection+': '+(err.message||err),true));
    }catch(err){showDatabaseMessage('Could not sync '+def.collection+': '+err.message,true)}
  };
}
async function uploadAllLocalCollections(){
  if(currentRole!=='admin'){alert('Only an admin can sync records to the database.');return}
  if(!supabaseClient){alert('Supabase is not configured in app.js.');return}
  if(!confirm('Upload this browser’s current records to Supabase? Existing records in each matching module will be replaced by this browser’s data. Download a backup first.'))return;
  try{
    remoteSyncEnabled=false;
    for(const def of SUPABASE_COLLECTIONS()) await upsertCollection(def.collection,safeReadArray(def.key));
    remoteSyncEnabled=true;
    showDatabaseMessage('All current browser records uploaded to Supabase.');
    alert('Upload complete. Check Table Editor → app_records.');
  }catch(err){remoteSyncEnabled=true;showDatabaseMessage('Upload failed: '+(err.message||err),true);alert('Upload failed: '+(err.message||err));}
}
async function finishSupabaseLogin(user){
  currentRole=await getCurrentUserRole(user);
  remoteSyncEnabled=false;
  await loadCollectionsFromDatabase();
  installStorageSync();remoteSyncEnabled=true;
  $('loginMessage').textContent='';$('loginPage').classList.add('hidden');$('appShell').classList.remove('hidden');
  $('userBadge').textContent=`Signed in: ${currentRole} (${user.email||''})`;
  document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('hidden',currentRole==='employee'&&b.dataset.view!=='customerFinder'));
  document.querySelectorAll('.admin-only').forEach(el=>el.classList.toggle('hidden',currentRole!=='admin'));
  showView(currentRole==='employee'?'customerFinder':'dashboard');renderAll();
  renderCustomers();refreshCustomerDropdown();renderReplacementModule();
  if(typeof renderQuotationRegister==='function')renderQuotationRegister();
  if(typeof renderChallanTable==='function')renderChallanTable();
  showDatabaseMessage('Connected to Supabase.');
}
async function initializeSupabaseSession(){
  if(!supabaseClient){$('loginMessage').textContent='Setup required: add your Supabase Project URL and Publishable key in app.js.';return;}
  const {data,error}=await supabaseClient.auth.getSession();
  if(error){$('loginMessage').textContent='Could not check Supabase session: '+error.message;return;}
  if(data.session){try{await finishSupabaseLogin(data.session.user)}catch(err){console.error(err);$('loginMessage').textContent=err.message||'Could not load your shared database records.';await supabaseClient.auth.signOut()}}
}
initializeSupabaseSession();
