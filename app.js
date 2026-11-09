(()=>{
  const bank=window.QUESTION_BANK||[];
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const letters="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const STORE="iot-study-bank-progress-v1";
  let progress=loadProgress();
  let currentMode="study";
  let filtered=[];
  let currentIndex=0;
  let selected=new Set();
  let graded=false;
  let examQuestions=[];

  function emptyProgress(){return {attempts:0,correct:0,per:{},wrong:[]};}
  function loadProgress(){
    try{
      const raw=JSON.parse(localStorage.getItem(STORE)||"null");
      if(!raw||typeof raw!=="object")return emptyProgress();
      return {
        attempts:Number.isFinite(Number(raw.attempts))?Number(raw.attempts):0,
        correct:Number.isFinite(Number(raw.correct))?Number(raw.correct):0,
        per:raw.per&&typeof raw.per==="object"?raw.per:{},
        wrong:Array.isArray(raw.wrong)?raw.wrong.map(Number).filter(Number.isFinite):[]
      };
    }catch{return emptyProgress();}
  }
  function saveProgress(){
    try{localStorage.setItem(STORE,JSON.stringify(progress));}catch{}
    updateStats();
  }
  function esc(v){return String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
  function sameAnswer(a,b){return [...a].sort((x,y)=>x-y).join(",")===[...b].sort((x,y)=>x-y).join(",");}
  function shuffle(arr){return [...arr].sort(()=>Math.random()-.5);}
  function typeName(q){return q.type==="multi"?"多选题":q.type==="tf"?"判断题":"单选题";}

  function updateStats(){
    $("#statDone").textContent=Object.keys(progress.per||{}).length;
    $("#statAccuracy").textContent=progress.attempts?Math.round(progress.correct/progress.attempts*100)+"%":"0%";
    $("#statWrong").textContent=(progress.wrong||[]).length;
  }
  function applyFilters(){
    const ch=$("#chapterFilter").value,src=$("#sourceFilter").value,diff=$("#difficultyFilter").value;
    filtered=bank.filter(q=>(ch==="all"||q.chapter===ch)&&(src==="all"||(src==="original"?q.original:src==="ppt"?!q.original:src==="past"?(q.source.includes("上次测验")):q.source===src))&&(diff==="all"||q.difficulty===diff));
    if(currentIndex>=filtered.length)currentIndex=0;
    renderStudy();
  }

  function renderStudy(){
    selected=new Set();graded=false;
    const card=$("#questionCard");
    if(!filtered.length){
      card.innerHTML='<div class="empty-state">当前筛选条件下没有题目，请调整左侧筛选。</div>';
      $("#positionText").textContent="0 / 0";$("#progressBar").style.width="0";return;
    }
    const q=filtered[currentIndex];
    $("#questionMeta").textContent=`${q.chapter}模块 · ${q.source}`;
    $("#questionTitle").textContent=typeName(q);
    $("#positionText").textContent=`${currentIndex+1} / ${filtered.length}`;
    $("#progressBar").style.width=((currentIndex+1)/filtered.length*100)+"%";
    $("#prevBtn").disabled=currentIndex===0;
    $("#nextBtn").disabled=currentIndex===filtered.length-1;
    card.innerHTML=`
      <div class="badges">
        <span class="badge">${typeName(q)}</span>
        <span class="badge ${q.difficulty==='易错'?'danger':''}">${esc(q.difficulty)}</span>
        <span class="badge ${q.original?'original':''}">${q.original?'老师原题':'PPT 衍生题'}</span>
      </div>
      <h3 class="question-text">${esc(q.text)}</h3>
      <div class="options">${q.options.map((o,i)=>`<button class="option" data-i="${i}" type="button"><span class="letter">${letters[i]}</span><span>${esc(o)}</span></button>`).join("")}</div>
      ${q.type==="multi"?'<button class="primary multi-confirm" id="confirmMulti" type="button" disabled>确认多选答案</button>':''}
      <div id="answerBox"></div>`;
    card.querySelectorAll(".option").forEach(btn=>btn.addEventListener("click",()=>chooseOption(q,Number(btn.dataset.i),btn)));
    const confirm=$("#confirmMulti");if(confirm)confirm.addEventListener("click",()=>gradeStudy(q));
  }

  function chooseOption(q,i,btn){
    if(graded)return;
    if(q.type==="multi"){
      selected.has(i)?selected.delete(i):selected.add(i);
      btn.classList.toggle("selected",selected.has(i));
      $("#confirmMulti").disabled=selected.size===0;
    }else{
      selected=new Set([i]);btn.classList.add("selected");gradeStudy(q);
    }
  }

  function gradeStudy(q){
    if(graded||!selected.size)return;graded=true;
    const ok=sameAnswer(selected,q.answers);
    $("#questionCard").querySelectorAll(".option").forEach(btn=>{
      const i=Number(btn.dataset.i);btn.disabled=true;
      if(q.answers.includes(i))btn.classList.add("correct");
      else if(selected.has(i))btn.classList.add("wrong");
    });
    const confirm=$("#confirmMulti");if(confirm)confirm.hidden=true;
    const rightText=q.answers.map(i=>`${letters[i]}. ${q.options[i]}`).join("；");
    $("#answerBox").innerHTML=`<div class="answer-box ${ok?'good':'bad'}"><b>${ok?'回答正确':'回答错误'} · 正确答案：${esc(rightText)}</b><p>${esc(q.explanation)}</p></div>`;
    record(q.id,ok);
  }

  function record(id,ok){
    progress.attempts=(progress.attempts||0)+1;if(ok)progress.correct=(progress.correct||0)+1;
    progress.per=progress.per||{};const p=progress.per[id]||{attempts:0,correct:0};p.attempts++;if(ok)p.correct++;p.lastCorrect=ok;progress.per[id]=p;
    const wrong=new Set(progress.wrong||[]);ok?wrong.delete(id):wrong.add(id);progress.wrong=[...wrong];saveProgress();
  }

  function switchMode(mode){
    currentMode=mode;$$('.mode').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
    $("#studyView").hidden=mode!=="study";$("#examView").hidden=mode!=="exam";$("#wrongView").hidden=mode!=="wrong";
    if(mode==="wrong")renderWrong();
  }

  function startExam(){
    const set=$("#examSetFilter")?.value||"random";
    const setPool=set==="sim1"?bank.filter(q=>q.source==="模拟题一"):set==="sim2"?bank.filter(q=>q.source==="模拟题二"):(filtered.length?filtered:bank);
    examQuestions=shuffle(setPool).slice(0,Math.min(20,setPool.length));
    $("#examIntro").hidden=true;$("#examForm").hidden=false;$("#examActions").hidden=false;$("#examResult").hidden=true;
    $("#examForm").innerHTML=examQuestions.map((q,qi)=>`<section class="exam-question" data-qi="${qi}"><div class="badges"><span class="badge">第 ${qi+1} 题</span><span class="badge">${typeName(q)}</span>${q.original?'<span class="badge original">老师原题</span>':''}</div><h3>${esc(q.text)}</h3>${q.options.map((o,i)=>`<label><input type="${q.type==='multi'?'checkbox':'radio'}" name="exam-${qi}" value="${i}"><span>${letters[i]}. ${esc(o)}</span></label>`).join("")}<div class="exam-feedback"></div></section>`).join("");
    $("#examView .panel-head p").textContent=`随机抽取 ${examQuestions.length} 题`;
    window.scrollTo({top:$("#examView").offsetTop-90,behavior:"smooth"});
  }
  function resetExam(){
    $("#examIntro").hidden=false;$("#examForm").hidden=true;$("#examActions").hidden=true;$("#examResult").hidden=true;$("#examForm").innerHTML="";
  }
  function submitExam(){
    let score=0;
    examQuestions.forEach((q,qi)=>{
      const section=$(`.exam-question[data-qi="${qi}"]`);const picked=[...section.querySelectorAll('input:checked')].map(x=>Number(x.value));const ok=sameAnswer(picked,q.answers);if(ok)score++;
      section.classList.add(ok?'review-correct':'review-wrong');section.querySelectorAll('input').forEach(x=>x.disabled=true);
      const right=q.answers.map(i=>`${letters[i]}. ${q.options[i]}`).join("；");section.querySelector('.exam-feedback').innerHTML=`<div class="answer-box ${ok?'good':'bad'}"><b>${ok?'正确':'错误'} · 答案：${esc(right)}</b><p>${esc(q.explanation)}</p></div>`;record(q.id,ok);
    });
    const mark=Math.round(score/examQuestions.length*100);$("#examResult").hidden=false;$("#examResult").innerHTML=`<strong>${mark}</strong><h3>${mark>=85?'掌握得很好':mark>=60?'基础合格，继续补错题':'建议回到背题模式逐章复习'}</h3><p>答对 ${score} / ${examQuestions.length} 题，所有题目已显示答案与解析。</p>`;$("#examActions").hidden=true;$("#examResult").scrollIntoView({behavior:"smooth",block:"center"});
  }

  function renderWrong(){
    const ids=new Set(progress.wrong||[]);const wrong=bank.filter(q=>ids.has(q.id));const box=$("#wrongList");
    if(!wrong.length){box.innerHTML='<div class="empty-state"><b>目前没有错题</b><br><br>在背题或模拟考试中答错的题目会自动出现在这里。</div>';return;}
    box.innerHTML=wrong.map(q=>`<article class="wrong-item"><div class="badges"><span class="badge">${esc(q.chapter)}</span><span class="badge ${q.original?'original':''}">${q.original?'老师原题':'PPT 衍生题'}</span></div><h3>${esc(q.text)}</h3><p>正确答案：${esc(q.answers.map(i=>q.options[i]).join('；'))}</p><button class="ghost practice-wrong" data-id="${q.id}">重新练习</button></article>`).join("");
    box.querySelectorAll('.practice-wrong').forEach(b=>b.addEventListener('click',()=>openQuestion(Number(b.dataset.id))));
  }
  function openQuestion(id){
    const target=bank.find(q=>q.id===id);if(!target)return;$("#chapterFilter").value=target.chapter;$("#sourceFilter").value="all";$("#difficultyFilter").value="all";applyFilters();const found=filtered.findIndex(q=>q.id===id);if(found<0)return;currentIndex=found;renderStudy();switchMode("study");window.scrollTo({top:$("#studyView").offsetTop-90,behavior:"smooth"});
  }

  $$('.mode').forEach(b=>b.addEventListener('click',()=>switchMode(b.dataset.mode)));
  ["#chapterFilter","#sourceFilter","#difficultyFilter"].forEach(s=>$(s).addEventListener('change',()=>{currentIndex=0;applyFilters();}));
  $("#prevBtn").addEventListener('click',()=>{if(currentIndex>0){currentIndex--;renderStudy();}});
  $("#nextBtn").addEventListener('click',()=>{if(currentIndex<filtered.length-1){currentIndex++;renderStudy();}});
  $("#randomBtn").addEventListener('click',()=>{if(filtered.length){currentIndex=Math.floor(Math.random()*filtered.length);renderStudy();}});
  $("#startExamBtn").addEventListener('click',startExam);$("#newExamBtn").addEventListener('click',resetExam);$("#submitExamBtn").addEventListener('click',submitExam);
  $("#clearWrongBtn").addEventListener('click',()=>{progress.wrong=[];saveProgress();renderWrong();});
  $("#resetProgress").addEventListener('click',()=>{if(confirm("确定清空当前浏览器中的练习记录、正确率和错题本吗？")){progress={attempts:0,correct:0,per:{},wrong:[]};saveProgress();renderStudy();}});
  $("#totalCount").textContent=bank.length;$("#originalCount").textContent=bank.filter(q=>q.original).length;updateStats();applyFilters();
})();
