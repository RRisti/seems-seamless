const GRID_TRANSITIONING_CLASS_NAME = '__transitioning';
const GRID_TRANSITIONING_PROPERTY_NAME = 'background-size';
export const gridElement = document.querySelector('.grid');

const toggleGridElementTransitioningClassName = (condition) =>
    gridElement.classList.toggle(GRID_TRANSITIONING_CLASS_NAME, condition);

export const enableGridTransition = () => toggleGridElementTransitioningClassName(true);

gridElement.addEventListener('transitionend', ({ propertyName }) => {
    if (propertyName === GRID_TRANSITIONING_PROPERTY_NAME) {
        toggleGridElementTransitioningClassName(false);
    }
});
