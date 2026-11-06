(function(root){
'use strict';
const fields=[
 ['class_group','Группа классов','В каком классе ты учишься?'],
 ['school_rating','Общая оценка','Как ты в целом оцениваешь школьную жизнь?'],
 ['recreation_rating','Удобство рекреаций','Насколько тебе удобно отдыхать на переменах в рекреациях с диванами?'],
 ['space_priorities','Улучшения пространств','Что в пространствах для отдыха стоит улучшить в первую очередь?'],
 ['media_awareness','Медиа-классы','Что ты знаешь о медиа-классах в школе?'],
 ['sections','Секции','Какие школьные секции ты посещаешь?'],
 ['information_access','Доступ к информации','Насколько легко найти информацию о секциях, школьных занятиях и мероприятиях?'],
 ['schedule_rating','Удобство расписания','Насколько удобно тебе совмещать расписание уроков с отдыхом и занятиями после школы?'],
 ['improvement_priorities','Приоритеты','Какие две темы улучшений для тебя наиболее важны?'],
 ['suggestion','Свободная идея','Какую одну идею ты предложил(а) бы для школьной жизни?']
].map(([key,label,title])=>({key,label,title}));
const norm=s=>String(s??'').replace(/^\uFEFF/,'').toLowerCase().replace(/ё/g,'е').replace(/^\s*\d+[.)]\s*/,'').replace(/[^a-zа-я0-9]/g,'');
function parseCSV(text){
 text=String(text).replace(/^\uFEFF/,'');if(!text.trim())throw Error('Файл пуст.');
 const first=text.split(/\r?\n/)[0];let quoted=false;const counts={',':0,';':0,'\t':0};for(let i=0;i<first.length;i++){if(first[i]==='"')quoted=!quoted;else if(!quoted&&first[i] in counts)counts[first[i]]++;}
 const sep=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
 const rows=[];let row=[],cell='',inQuote=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(inQuote){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{inQuote=false;closed=true;}}else cell+=c;continue;}
 if(c==='"'){if(cell.length||closed)throw Error('Некорректные кавычки в CSV.');inQuote=true;}
 else if(c===sep){row.push(cell);cell='';closed=false;}
 else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';closed=false;}
 else{if(closed&&!/\s/.test(c))throw Error('Лишние символы после кавычек в CSV.');if(!closed)cell+=c;}}
 if(inQuote)throw Error('В CSV не закрыты кавычки.');row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
 if(rows.length<2)throw Error('Нужны заголовки и хотя бы один ответ.');
 const headers=rows.shift().map(x=>x.trim());if(headers.length<2)throw Error('Не удалось найти столбцы CSV.');
 const bad=rows.findIndex(r=>r.length!==headers.length);if(bad>=0)throw Error('Строка '+(bad+2)+': число значений отличается от числа столбцов.');
 if(rows.length>20000)throw Error('Слишком много строк. Максимум — 20 000.');return {headers,rows,sep};
}
function autoMap(headers){return Object.fromEntries(fields.map(f=>[f.key,headers.findIndex(h=>norm(h)===norm(f.key)||norm(h)===norm(f.title))]));}
function rating(v){const m=String(v).trim().match(/^([1-5])(?:\s*(?:[—–\-:.]|балл|из)|\s*$)/i);return m?Number(m[1]):null;}
function group(v){const s=String(v).replace(/[–—]/g,'-').replace(/\s/g,'');if(/^5-7/.test(s))return '5–7';if(/^8-9/.test(s))return '8–9';if(/^10-11/.test(s))return '10–11';return 'other';}
function convert(parsed,mapping){
 const used=Object.values(mapping).filter(i=>i>=0);if(!used.length)throw Error('Выбери хотя бы один столбец.');if(new Set(used).size!==used.length)throw Error('Один столбец выбран для нескольких вопросов.');
 const records=parsed.rows.map((row,i)=>{const r={id:i+1};for(const f of fields)r[f.key]=mapping[f.key]>=0?String(row[mapping[f.key]]??'').trim():'';r.group=group(r.class_group);return r;}).filter(r=>fields.some(f=>r[f.key]));
 if(!records.length)throw Error('В выбранных столбцах нет ответов.');
 const warnings=[];for(const key of ['school_rating','recreation_rating','schedule_rating']){const invalid=records.filter(r=>r[key]&&rating(r[key])===null&&!/затрудня|не польз|не знаю/i.test(r[key]));if(invalid.length)warnings.push(fields.find(f=>f.key===key).label+': '+invalid.length+' ответов без распознанной оценки (не включены в среднее).');}
 return {records,warnings};
}
function distribution(records,key,multi=false){const counts=new Map();let answered=0;for(const r of records){const value=r[key];if(!value)continue;answered++;const parts=multi?value.split(/\s*\|\s*|\s*;\s*|,\s*/):[value];for(const p of new Set(parts.map(x=>x.trim()).filter(Boolean)))counts.set(p,(counts.get(p)||0)+1);}return {answered,items:[...counts].map(([label,count])=>({label,count,percent:answered?Math.round(count/answered*100):0})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'ru'))};}
function average(records,key){const a=records.map(r=>rating(r[key])).filter(x=>x!==null);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null;}
const multiKeys=['space_priorities','sections','improvement_priorities'];
function summarize(records){return {participants:records.length,average:average(records,'school_rating'),results:Object.fromEntries(fields.filter(f=>!['class_group','suggestion'].includes(f.key)).map(f=>[f.key,distribution(records,f.key,multiKeys.includes(f.key))]))};}
root.SchoolData={fields,norm,parseCSV,autoMap,rating,group,convert,distribution,average,summarize};
if(typeof module!=='undefined')module.exports=root.SchoolData;
})(typeof globalThis!=='undefined'?globalThis:this);
