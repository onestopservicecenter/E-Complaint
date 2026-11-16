(() => {
  const form = $('#complaintForm');
  if (!form) return;
  const progress = $('#complaintProgress');
  const errorText = $('#complaintError');
  const receipt = $('#complaintReceipt');
  const rewardChoice = $('#complaintReward');
  const rewardDocuments = $('#complaintRewardDocuments');
  const fileSlots = ['evidence1', 'evidence2', 'evidence3', 'evidence4', 'video', 'informant', 'payment', 'identityCopy', 'bankbook'];
  const chunkSize = 4 * 1024 * 1024;
  const field = name => form.elements.namedItem(name);
  let enabled = false;
  let requestId = uid();
  let submitting = false;
  const choiceLink = $('#complaintChoiceLink');
  const originalLink = choiceLink.href;

  CATEGORIES.forEach(category => $('#complaintCategory').add(new Option(category, category)));

  function render() {
    $('#complaintFallback').hidden = enabled;
    $('#surveillancePending').hidden = enabled;
    $('#surveillanceLink').hidden = !enabled;
    choiceLink.href = enabled ? '#intake' : originalLink;
    choiceLink.target = enabled ? '_self' : '_blank';
    $('#complaintLogin').classList.toggle('hidden', !enabled || !!user);
    form.classList.toggle('hidden', !enabled || !user);
    $('#complaintEmail').textContent = user?.email || '';
  }

  function updateReward() {
    const proceeding = field('prosecution').value === 'proceed';
    const wantsReward = proceeding && field('reward').value === 'yes';
    rewardChoice.hidden = rewardChoice.disabled = !proceeding;
    rewardDocuments.hidden = rewardDocuments.disabled = !wantsReward;
    if (!proceeding) Array.from(field('reward')).forEach(option => { option.checked = false; });
    if (!wantsReward) {
      rewardDocuments.querySelectorAll('input').forEach(input => { input.value = ''; });
    }
  }

  function readChunk(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(Error('อ่านไฟล์ไม่ได้'));
      reader.readAsDataURL(blob);
    });
  }

  async function upload(slot, file, activeSession, payload) {
    const identity = {requestId: payload.requestId, slot};
    const chunks = [];
    for (let offset = 0; offset < file.size; offset += chunkSize) {
      chunks.push(await crypto.subtle.digest('SHA-256', await file.slice(offset, offset + chunkSize).arrayBuffer()));
    }
    const fingerprints = new Uint8Array(chunks.length * 32);
    chunks.forEach((hash, index) => fingerprints.set(new Uint8Array(hash), index * 32));
    const signature = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', fingerprints)),
      byte => byte.toString(16).padStart(2, '0')).join('');
    if (session !== activeSession) throw Error('กรุณาเข้าสู่ระบบใหม่');
    let state = await api('beginIntakeFile', {...identity, name: file.name, size: file.size, signature,
      prosecution: payload.prosecution, reward: payload.reward});
    while (!state.fileId && !state.committed) {
      const {offset} = state;
      progress.textContent = 'อัปโหลด ' + file.name + ' ' + Math.floor(offset / file.size * 100) + '%';
      const base64 = await readChunk(file.slice(offset, offset + chunkSize));
      if (session !== activeSession) throw Error('กรุณาเข้าสู่ระบบใหม่');
      state = await api('writeIntakeChunk', {...identity, offset, base64});
      if (!state.fileId && !state.committed && state.offset <= offset) throw Error('การอัปโหลดหยุดลง กรุณากดส่งอีกครั้ง');
    }
  }

  function selectRoute() {
    if (location.hash === '#intake?type=monitor') {
      field('prosecution').value = 'monitor';
      updateReward();
    }
  }
  window.addEventListener('hashchange', selectRoute);
  selectRoute();

  document.addEventListener('catalog-ready', event => {
    enabled = !!(cfg.googleClientId && event.detail.publicIntake);
    render();
  });
  document.addEventListener('identity-changed', () => {
    if (!user) {
      form.reset();
      updateReward();
      requestId = uid();
      receipt.hidden = true;
      progress.textContent = errorText.textContent = '';
    }
    render();
  });
  $('#complaintSwitch').onclick = () => $('#logout').click();
  form.addEventListener('change', event => {
    if (['prosecution', 'reward'].includes(event.target.name)) updateReward();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || !enabled || !user || !form.reportValidity()) return;
    const data = new FormData(form);
    const files = fileSlots.map(slot => [slot, data.get(slot)]).filter(([, file]) => file?.name);
    const payload = Object.fromEntries([...data].filter(([, value]) => typeof value === 'string'));
    payload.acknowledge = data.has('acknowledge');
    payload.slots = files.map(([slot]) => slot);
    payload.requestId = requestId;
    receipt.hidden = true;
    errorText.textContent = '';
    const activeSession = session;
    submitting = true;
    $('#complaintSubmit').disabled = true;
    try {
      for (const [slot, file] of files) {
        if (!file.size || file.size > (slot === 'video' ? 100 : 10) * 1024 * 1024) {
          throw Error('ไฟล์ว่างหรือเกินขนาดที่กำหนด ' + file.name);
        }
      }
      for (const [slot, file] of files) await upload(slot, file, activeSession, payload);
      if (session !== activeSession) throw Error('กรุณาเข้าสู่ระบบใหม่');
      progress.textContent = 'กำลังบันทึกคำร้อง';
      const {id} = await api('submitPublicComplaint', payload);
      if (session !== activeSession) return;
      form.reset();
      updateReward();
      requestId = uid();
      progress.textContent = 'ส่งเรื่องสำเร็จ เลขรับเรื่อง ' + id;
      receipt.href = '#case=' + encodeURIComponent(id);
      receipt.hidden = false;
      await loadMyCases();
    } catch (error) {
      if (activeSession === session) {
        progress.textContent = '';
        errorText.textContent = error.message;
      }
    } finally {
      submitting = false;
      $('#complaintSubmit').disabled = false;
    }
  });
  render();
})();
