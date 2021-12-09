#!/usr/bin/env node

import yargs from 'yargs';
import dotenv from 'dotenv';
import { hideBin } from 'yargs/helpers';

dotenv.config();
yargs(hideBin(process.argv))
  // Use the commands directory to scaffold.
  .commandDir('commands')
  // Enable strict mode.
  .strict()
  // Useful aliases.
  .alias({ h: 'help' }).argv;
