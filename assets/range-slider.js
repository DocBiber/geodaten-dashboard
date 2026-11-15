"use strict";

const rangeSliderApi = (() => {
  const STEPS = 10000;
  const numberFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

  function isInRange(value, minimum, maximum) {
    return Number.isFinite(value) && Number.isFinite(minimum) && Number.isFinite(maximum) &&
      minimum <= maximum && value >= minimum && value <= maximum;
  }

  function valuesInRange(values, minimum, maximum) {
    return values.filter((value) => isInRange(value, minimum, maximum));
  }

  function scaleToValue(position, minimum, maximum, logarithmic = false) {
    if (![position, minimum, maximum].every(Number.isFinite) || minimum > maximum) return NaN;
    if (position <= 0) return minimum;
    if (position >= STEPS) return maximum;
    const fraction = position / STEPS;
    if (minimum === maximum) return minimum;
    if (logarithmic) {
      if (minimum <= 0) return NaN;
      const value = Math.exp(Math.log(minimum) + fraction * (Math.log(maximum) - Math.log(minimum)));
      const nearestInteger = Math.round(value);
      return Math.abs(value - nearestInteger) <= Number.EPSILON * Math.max(1, Math.abs(value)) * 4
        ? nearestInteger
        : value;
    }
    return minimum + fraction * (maximum - minimum);
  }

  function valueToScale(value, minimum, maximum, logarithmic = false) {
    if (![value, minimum, maximum].every(Number.isFinite) || minimum > maximum) return NaN;
    if (value <= minimum) return 0;
    if (value >= maximum) return STEPS;
    if (minimum === maximum) return 0;
    if (logarithmic) {
      if (minimum <= 0 || value <= 0) return NaN;
      return Math.max(0, Math.min(STEPS,
        (Math.log(value) - Math.log(minimum)) / (Math.log(maximum) - Math.log(minimum)) * STEPS
      ));
    }
    return Math.max(0, Math.min(STEPS, (value - minimum) / (maximum - minimum) * STEPS));
  }

  function resetRange(minimum, maximum) {
    return { minimum, maximum };
  }

  function createRangeSlider({
    container,
    minimum,
    maximum,
    initialMinimum = minimum,
    initialMaximum = maximum,
    logarithmic = false,
    formatValue = (value) => numberFormat.format(value),
    onChange = () => {}
  }) {
    const panel = document.createElement("div");
    panel.className = "range-slider";
    const inputs = [];
    const outputs = [];
    const labels = ["Von", "Bis"];
    const descriptions = ["Mindestwert", "Höchstwert"];
    let boundMinimum = minimum;
    let boundMaximum = maximum;
    let lowerValue = initialMinimum;
    let upperValue = initialMaximum;

    labels.forEach((text, index) => {
      const label = document.createElement("label");
      label.className = "range-slider__handle";
      const output = document.createElement("output");
      const input = document.createElement("input");
      input.type = "range";
      input.min = "0";
      input.max = String(STEPS);
      input.step = "1";
      input.setAttribute("aria-label", `${descriptions[index]} im Wertebereich`);
      label.append(`${text}: `, output, input);
      panel.append(label);
      inputs.push(input);
      outputs.push(output);
    });

    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "range-slider__reset";
    reset.textContent = "Zurücksetzen";
    panel.append(reset);
    container.replaceChildren(panel);
    globalThis.L?.DomEvent?.disableClickPropagation(panel);
    globalThis.L?.DomEvent?.disableScrollPropagation(panel);

    function render() {
      inputs[0].value = String(valueToScale(lowerValue, boundMinimum, boundMaximum, logarithmic));
      inputs[1].value = String(valueToScale(upperValue, boundMinimum, boundMaximum, logarithmic));
      outputs[0].textContent = formatValue(lowerValue);
      outputs[1].textContent = formatValue(upperValue);
      onChange({ minimum: lowerValue, maximum: upperValue });
    }

    inputs[0].addEventListener("input", () => {
      lowerValue = Math.min(
        scaleToValue(Number(inputs[0].value), boundMinimum, boundMaximum, logarithmic),
        upperValue
      );
      render();
    });
    inputs[1].addEventListener("input", () => {
      upperValue = Math.max(
        scaleToValue(Number(inputs[1].value), boundMinimum, boundMaximum, logarithmic),
        lowerValue
      );
      render();
    });
    reset.addEventListener("click", () => {
      const range = resetRange(initialMinimum, initialMaximum);
      lowerValue = range.minimum;
      upperValue = range.maximum;
      render();
    });

    render();
    return {
      setBounds(newMinimum, newMaximum, newInitialMinimum = newMinimum, newInitialMaximum = newMaximum) {
        if (![newMinimum, newMaximum, newInitialMinimum, newInitialMaximum].every(Number.isFinite) ||
            newMinimum > newMaximum || (logarithmic && newMinimum <= 0)) {
          throw new RangeError("Ungültiger Wertebereich für den Schieberegler.");
        }
        boundMinimum = newMinimum;
        boundMaximum = newMaximum;
        initialMinimum = Math.max(boundMinimum, Math.min(boundMaximum, newInitialMinimum));
        initialMaximum = Math.max(boundMinimum, Math.min(boundMaximum, newInitialMaximum));
        lowerValue = initialMinimum;
        upperValue = Math.max(lowerValue, initialMaximum);
        render();
      },
      getValues() {
        return { minimum: lowerValue, maximum: upperValue };
      }
    };
  }

  return { createRangeSlider, isInRange, resetRange, scaleToValue, valueToScale, valuesInRange };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = rangeSliderApi;
} else {
  globalThis.RangeSlider = rangeSliderApi;
}
