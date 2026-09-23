/* Editable preview, duplicate review, and event attendance overview. */
(() => {
  if (window.ContactImporterWorkspace) return;
  const Q = window.ContactImporterQuality;
  const panel = document.getElementById('contactsSection');
  const overview = document.getElementById('overviewSection');
  if (!Q || !panel || !overview) return;

  const dashboard = document.createElement('section');
  dashboard.className = 'event-audit glass';
  dashboard.innerHTML = `
    <div class="event-audit-head">
      <div><div class="section-kicker">Event operations</div>
      <h2>Registration overview</h2>
      <p>Attendance is an estimate from registration quantities, not a checked-in count.</p></div>
      <span class="mapping-state" id="reviewHealth">No contacts</span>
    </div>
    <div class="event-audit-grid">
      <div><small>Registrations</small><strong id="auditRegistrations">0</strong></div>
      <div><small>Minimum seats</small><strong id="auditSeats">0</strong></div>
      <div><small>Need review</small><strong id="auditReview">0</strong></div>
      <div><small>Duplicate records</small><strong id="auditDuplicate">0</strong></div>
      <div><small>Unspecified quantities</small><strong id="auditUnknown">0</strong></div>
    </div>
    <p id="auditFootnote">Each registration without a quantity is provisionally counted as one seat. Review flagged entries before syncing.</p>`;
  const statGrid = overview.querySelector('.stats-grid');
  if (statGrid) statGrid.insertAdjacentElement('afterend', dashboard);
  else overview.appendChild(dashboard);

  const toolbar = panel.querySelector('.toolbar');
  const tools = document.createElement('div');
  tools.className = 'contact-review-tools';
  tools.innerHTML = `
    <div class="contact-search-wrap"><label for="contactSearch">Search contacts</label>
      <input class="input" id="contactSearch" type="search" placeholder="Search name, phone, e-mail…" autocomplete="off"></div>
    <div><label for="contactFilter">Show</label><select id="contactFilter">
      <option value="all">All contacts</option>
      <option value="review">Need review</option>
      <option value="duplicates">Duplicates</option>
      <option value="excluded">Excluded</option>
    </select></div>
    <div class="review-hint" id="reviewHint">Edit cells directly. Changes stay in this browser until synced or exported.</div>`;
  if (toolbar) toolbar.insertAdjacentElement('afterend', tools);
  const search = tools.querySelector('#contactSearch');
  const filter = tools.querySelector('#contactFilter');
  const reviewHint = tools.querySelector('#reviewHint');
  let searchTerm = '';
  let currentFilter = 'all';

  function escape(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function memoChange() {
    if (window.ContactImporterRecovery) window.ContactImporterRecovery.captureUndo();
  }
  function changed() {
    if (window.ContactImporterRecovery) window.ContactImporterRecovery.markDirty();
    updateStats();
    updateDownloadState();
    renderPreview();
  }
  function renderAudit() {
    const result = Q.audit(contacts);
    const values = {auditRegistrations:result.registrations,auditSeats:result.minimumSeats,
      auditReview:result.review,auditDuplicate:result.duplicateRows,auditUnknown:result.unknownAttendance};
    Object.entries(values).forEach(([id,value]) => { const node=document.getElementById(id);if(node)node.textContent=value; });
    const health=document.getElementById('reviewHealth');
    if(health){health.textContent=result.review ? result.review+' to review' : contacts.length ? 'Ready for review' : 'No contacts';
      health.className='mapping-state'+(result.review ? '' : ' ready');}
    const foot=document.getElementById('auditFootnote');
    if (foot) foot.textContent=result.unknownAttendance
      ? result.unknownAttendance+' registration(s) have no reported guest quantity; counted as one seat each for this minimum.'
      : 'All included registrations have a reported guest quantity.';
    if (reviewHint) reviewHint.textContent=result.exportable+' exportable · '+result.invalidPhones+
      ' phone number(s) need correction · '+result.duplicateGroups.length+' duplicate group(s).';
  }
  function render() {
    const groups=Q.duplicateGroups(contacts), duplicateIndexes=new Set(groups.flat());
    const groupLeader=new Map();
    groups.forEach(group=>group.forEach(index=>groupLeader.set(index,group[0])));
    previewBody.innerHTML='';
    const settings=getMarketingSettings();
    const candidates=contacts.map((item,index)=>({item,index})).filter(({item,index})=>{
      const term=[item.fullName,item.phone,item.email,item.note,item.notes].join(' ').toLowerCase();
      if(searchTerm && !term.includes(searchTerm))return false;
      const hasIssue=Q.contactIssues(item).length || duplicateIndexes.has(index);
      if(currentFilter==='review'&&!hasIssue)return false;
      if(currentFilter==='duplicates'&&!duplicateIndexes.has(index))return false;
      if(currentFilter==='excluded'&&!item.excluded)return false;
      return true;
    });
    candidates.slice(0,250).forEach(({item,index})=>{
      const row=document.createElement('tr');
      if(item.excluded)row.className='contact-excluded';
      else if(duplicateIndexes.has(index))row.className='contact-duplicate';
      const issues=Q.contactIssues(item);
      if(duplicateIndexes.has(index))issues.push('Duplicate of row '+(groupLeader.get(index)+1));
      const attendee=Q.attendeeCount(item);
      const field=(key,type='text',value=item[key]||'')=>`<input class="contact-cell-input" type="${type}" data-row="${index}" data-field="${key}" value="${escape(value)}" aria-label="${escape(key)} for row ${index+1}">`;
      row.innerHTML=`
        <td data-label="Row">${index+1}</td>
        <td data-label="Name">${field('fullName')}<small>${escape(issues.join(' · ')||'OK')}</small></td>
        <td data-label="Phone">${field('phone','tel')}</td>
        <td data-label="E-mail">${field('email','email')}</td>
        <td data-label="Notes">${field('note','text',item.note||item.notes||'')}</td>
        <td data-label="Guests">${field('attendees','number',attendee==null?'':attendee)}</td>
        <td data-label="Campaign">${escape(settings.event||'—')}</td>
        <td data-label="Review"><div class="contact-row-actions">
          <button type="button" class="glass-btn" data-action="exclude" data-row="${index}">${item.excluded?'Include':'Exclude'}</button>
          ${duplicateIndexes.has(index)&&groupLeader.get(index)!==index?`<button type="button" class="glass-btn" data-action="merge" data-row="${index}" data-target="${groupLeader.get(index)}">Merge</button>`:''}
        </div></td>`;
      previewBody.appendChild(row);
    });
    previewTable.style.display=candidates.length?'table':'none';
    emptyState.style.display=candidates.length?'none':'block';
    if (!candidates.length) emptyState.textContent=contacts.length?'No contacts match this filter.':'Import a spreadsheet to begin.';
    if(candidates.length>250){
      const row=document.createElement('tr'); const cell=document.createElement('td');cell.colSpan=8;
      cell.textContent='Showing first 250 of '+candidates.length+' matches. Use search to narrow the results.';
      row.appendChild(cell);previewBody.appendChild(row);
    }
    renderAudit();
  }

  function updateField(index,field,value) {
    const item=contacts[index];
    if(!item)return;
    const next=field==='phone'?Q.normalizePhone(value):String(value).trim();
    if(field==='attendees'){
      const count=Number(next);
      if(next && (!Number.isInteger(count)||count<1||count>1000)){
        setStatus('Guest quantity must be between 1 and 1000.','error');render();return;
      }
      memoChange();
      item.attendees=next?count:null;
      const old=String(item.note||item.notes||'');
      const label='Jumlah Penonton';
      const pattern=/(?:jumlah\s+(?:penonton|peserta|tiket|orang)|(?:ticket|guest|attendee)\s+(?:count|quantity|qty))[^\r\n:]*:\s*\d+\b/i;
      const updated=next?(pattern.test(old)?old.replace(pattern,label+': '+count):[old,label+': '+count].filter(Boolean).join('\n')):old.replace(pattern,'').trim();
      item.note=updated;item.notes=updated;
    }else{
      const previous=String(field==='note'?(item.note||item.notes||''):(item[field]||'')).trim();
      if(previous===next)return;
      memoChange();
      if(field==='note'){item.note=next;item.notes=next;}
      else item[field]=field==='fullName'?normalizeIndonesianName(next):next;
    }
    changed();
  }

  previewBody.addEventListener('change',event=>{
    const input=event.target.closest('[data-field][data-row]');
    if(input)updateField(Number(input.dataset.row),input.dataset.field,input.value);
  });
  previewBody.addEventListener('click',event=>{
    const button=event.target.closest('button[data-action][data-row]');
    if(!button)return;
    const index=Number(button.dataset.row),item=contacts[index];
    if(!item)return;
    if(button.dataset.action==='exclude'){
      memoChange();item.excluded=!item.excluded;changed();return;
    }
    if(button.dataset.action==='merge'){
      const target=contacts[Number(button.dataset.target)];
      if(!target||target===item)return;
      if(!window.confirm('Merge this duplicate into row '+(Number(button.dataset.target)+1)+'? Conflicting names and notes will be preserved in the notes.'))return;
      memoChange();
      if(!target.phone)target.phone=item.phone;
      if(!target.email)target.email=item.email;
      let notes=[target.note||target.notes||'',item.note||item.notes||''];
      if(target.fullName!==item.fullName)notes.push('Alternate name: '+item.fullName);
      if(target.phone&&item.phone&&target.phone!==item.phone)notes.push('Alternate phone: '+item.phone);
      if(target.email&&item.email&&target.email!==item.email)notes.push('Alternate e-mail: '+item.email);
      const merged=Array.from(new Set(notes.map(v=>String(v).trim()).filter(Boolean))).join('\n');
      target.note=merged;target.notes=merged;
      target.attendees=Math.max(Q.attendeeCount(target)||1,Q.attendeeCount(item)||1);
      contacts.splice(index,1);changed();
      setStatus('Duplicate merged. Review the merged notes before syncing.','success');
    }
  });
  search.addEventListener('input',()=>{searchTerm=search.value.trim().toLowerCase();render();});
  filter.addEventListener('change',()=>{currentFilter=filter.value;render();});
  renderPreview=render;
  const previousClear=clearPreview;
  clearPreview=function(message){previousClear(message);renderAudit();};
  window.ContactImporterWorkspace={refresh:render,audit:renderAudit};
  render();
})();
