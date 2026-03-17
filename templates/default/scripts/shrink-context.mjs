import { stdin, stdout } from 'node:process';

let input = '';
stdin.setEncoding('utf8');
stdin.on('data', (chunk) => {
  input += chunk;
});

stdin.on('end', () => {
  const maxChars = 4000;
  if (input.length <= maxChars) {
    stdout.write(input);
    return;
  }
  stdout.write(`${input.slice(0, maxChars)}\n...(content trimmed by post-processor)`);
});
