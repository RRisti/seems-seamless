const informationTextElement = document.querySelector('.informationText');
let previousLabelText = '';

export const setLabelText = (text) => {
    if (previousLabelText !== informationTextElement.textContent) {
        previousLabelText = informationTextElement.textContent;
    }
    informationTextElement.textContent = `${text}`;
};

export const revertLabelText = () => setLabelText(previousLabelText);
