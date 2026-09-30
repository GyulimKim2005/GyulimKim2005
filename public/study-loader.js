(() => {
  let module;
  window.StudyNotesReady=()=>module||(module=import('/study/study-editor.js').catch(error=>{module=null;throw error;}));
})();
