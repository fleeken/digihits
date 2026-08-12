// Digihits match state machine. Keep view transitions in one place.
const MATCH_VIEWS = Object.freeze({
  WAITING: "waiting",
  READY: "ready",
  LISTEN: "listen",
  GUESS: "guess",
  PLACE: "place",
  RESULT: "result",
  OVERVIEW: "overview",
  ENDED: "ended"
});

function createMatchViewState(initialView=MATCH_VIEWS.WAITING){
  return { view:initialView, songId:null, guessStepDone:false };
}

function beginMatchSong(state,songId){
  return { ...state, view:MATCH_VIEWS.GUESS, songId:String(songId||""), guessStepDone:false };
}

function showMatchGuess(state,songId=state?.songId){
  return { ...state, view:MATCH_VIEWS.GUESS, songId:String(songId||""), guessStepDone:false };
}

function finishMatchGuess(state,{saveGuess=false}={}){
  return { ...state, view:MATCH_VIEWS.PLACE, guessStepDone:true, guessSaved:!!saveGuess };
}

function showMatchPlace(state){
  return { ...state, view:MATCH_VIEWS.PLACE };
}

function setMatchView(state,view,songId=state?.songId){
  return { ...state, view, songId:String(songId||state?.songId||"") };
}

function resetMatchViewState(){
  return createMatchViewState();
}

function resolveMatchView({stateView, placementMode=false, view="listen", guessStepDone=false}={}){
  if(stateView===MATCH_VIEWS.PLACE || placementMode || view===MATCH_VIEWS.PLACE){
    return MATCH_VIEWS.PLACE;
  }
  if(view===MATCH_VIEWS.GUESS || !guessStepDone){
    return MATCH_VIEWS.GUESS;
  }
  return view;
}

function showMatchResult(state){
  return { ...state, view:MATCH_VIEWS.RESULT };
}
