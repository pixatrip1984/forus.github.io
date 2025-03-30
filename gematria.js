// Gematria Calculation Module

// Simple Ordinal Mapping (A=1, B=2, ... Z=26)
const gematriaValues = {
  'a': 1, 'b': 2, 'c': 3, 'd': 4, 'e': 5, 'f': 6, 'g': 7, 'h': 8, 'i': 9,
  'j': 10, 'k': 20, 'l': 30, 'm': 40, 'n': 50, 'o': 60, 'p': 70, 'q': 80, 'r': 90,
  's': 100, 't': 200, 'u': 300, 'v': 400, 'w': 500, 'x': 600, 'y': 700, 'z': 800
};

function calculateGematria(text) {
  let total = 0;
  const breakdown = [];
  const lowerCaseText = text.toLowerCase();

  for (let i = 0; i < lowerCaseText.length; i++) {
    const char = lowerCaseText[i];
    if (gematriaValues.hasOwnProperty(char)) {
      const value = gematriaValues[char];
      total += value;
      breakdown.push({ letter: text[i], value: value }); 
    } else if (char === ' ') {
         // Optionally add space representation or ignore
         // breakdown.push({ letter: '\u00A0', value: null }); 
    } else {
         // Handle non-alphabetic characters (optional: display them without value)
         // breakdown.push({ letter: char, value: null });
    }
  }

  return { total, breakdown };
}

function displayResults(total, breakdown) {
  const breakdownContainer = document.getElementById('gematria-breakdown');
  const totalContainer = document.getElementById('gematria-total');

  breakdownContainer.innerHTML = ''; 

  if (breakdown.length === 0) {
      breakdownContainer.textContent = '-';
      totalContainer.textContent = '-';
      return;
  }

  breakdown.forEach(item => {
    const span = document.createElement('span');
    if (item.value !== null) {
        span.innerHTML = `<span class="letter">${item.letter}</span><span class="value">${item.value}</span>`;
    } else {
        span.innerHTML = `<span class="letter">${item.letter}</span>`;
    }
    breakdownContainer.appendChild(span);
  });

  totalContainer.textContent = total;
}

export function setupGematriaCalculator() {
  const calculateBtn = document.getElementById('gematria-calculate-btn');
  const inputField = document.getElementById('gematria-input');

  if (!calculateBtn || !inputField) {
    console.error("Gematria calculator elements not found!");
    return;
  }

  calculateBtn.addEventListener('click', () => {
    const inputText = inputField.value.trim();
    if (inputText) {
      const { total, breakdown } = calculateGematria(inputText);
      displayResults(total, breakdown);
    } else {
        displayResults(0, []); 
    }
  });

  inputField.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      calculateBtn.click(); 
    }
  });

  displayResults(0, []);
}