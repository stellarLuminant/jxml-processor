// =============== GENERIC HELPER FUNCTIONS ===============

var sayTemplate = Embed(`<Behavior text="{_text}" bubbleTime="{_time}">Say</Behavior>`);
var sayState = Embed(`<Transition playerSays="{_id}">{_id}</Transition>`);
var say = (text, time) => sayTemplate(text, time || 0.0);

var deleteObjectTemplate = Embed(`<Behavior objectId="{_objectId}" radius="{_radius}">DeleteObject</Behavior>`);
var deleteDecoy = (radius) => {
  return deleteObjectTemplate("Decoy", radius) +
    deleteObjectTemplate("Dire Decoy", radius) +
    deleteObjectTemplate("Golem Decoy 2", radius) +
    deleteObjectTemplate("Heart Decoy", radius) +
    deleteObjectTemplate("Refraction Cloak Decoy", radius) +
    deleteObjectTemplate("Mimicry Decoy", radius) +
    deleteObjectTemplate("Prismimic Decoy", radius) +
    deleteObjectTemplate("Prismimic Decoy Master", radius) +
    deleteObjectTemplate("HGolem Decoy 2", radius) +
    deleteObjectTemplate("Alien Decoy", radius)
};
