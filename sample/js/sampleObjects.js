var SampleObjects = {}

SampleObjects.data = "This NEW data also needs to be printed out!";

SampleObjects.dataCall = (bubbleTime) => `<Behavior text="${SampleObjects.data}" bubbleTime="${bubbleTime}">Say</Behavior>`;
