/**
 * Reads deploy config JSON (see deploy.devnet.json / deploy.mainnet.json).
 *
 * From repo root:
 *   pnpm deploy:solana:devnet
 *   pnpm deploy:solana:mainnet
 *
 * Or: DEPLOY_CONFIG=./path/to/config.json tsx scripts/deploy-from-config.ts
 *
 * Requires `anchor` on PATH and `cargo build-sbf` (from the Agave/Solana release
 * install — not Homebrew `solana`, which omits BPF build tools). Fund the wallet.
 */
import * as anchor from '@anchor-lang/core';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from '@solana/web3.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOLANA_WS = path.resolve(__dirname, '..');

interface DeployConfig {
  cluster: string;
  rpcUrl: string;
  anchorWallet: string;
  preDeploy: {
    keysSync: boolean;
    build: boolean;
    deploy: boolean;
    /** If set, `anchor deploy -p <name>` only (overrides per-program deploy flags). */
    programName?: string;
  };
  escrow: {
    /** If false, skip `anchor deploy` for this program only. Default true. */
    deploy?: boolean;
    crate: string;
    initialize: boolean;
    payerKeypair: string;
    superAdminKeypair: string;
    feeRecipient: string;
    /** Base58 pubkeys allowed to sign refund / SPL capture authority / dispute admin txs (max 8 on-chain). */
    transactionAuthorities: string[];
    /** Ed25519 pubkeys whose signatures are accepted for `capture_*` auth (max 8 on-chain). */
    authorizedNoderailsKeys: string[];
  };
  merchantManager: {
    /** If false, skip `anchor deploy` for this program only. Default true. */
    deploy?: boolean;
    crate: string;
    initialize: boolean;
    payerKeypair: string;
    superAdminKeypair: string;
    firstAdminKeypair: string;
  };
}

function loadJsonConfig(configPath: string): DeployConfig {
  const raw = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(raw) as DeployConfig;
}

function resolveConfigPath(): string {
  const fromEnv = process.env.DEPLOY_CONFIG?.trim();
  const fromArg = process.argv[2]?.trim();
  const candidate =
    fromArg ||
    fromEnv ||
    path.join(SOLANA_WS, 'deploy.devnet.json');
  const abs = path.isAbsolute(candidate)
    ? candidate
    : path.resolve(SOLANA_WS, candidate);
  if (!fs.existsSync(abs)) {
    throw new Error(
      `Missing ${abs}. Use pnpm deploy:solana:devnet / deploy:solana:mainnet, set DEPLOY_CONFIG, or pass a path as argv[2].`,
    );
  }
  return abs;
}

function resolvePath(configDir: string, p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(configDir, p);
}

function loadKeypairBytes(filePath: string): Keypair {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(raw)) {
    throw new Error(`Keypair must be JSON byte array: ${filePath}`);
  }
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function run(cmd: string, args: string[], cwd: string): void {
  const res = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env },
  });
  if (res.error) {
    throw res.error;
  }
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited ${res.status}`);
  }
}

/** Homebrew `solana` does not ship `cargo-build-sbf`; the Anza installer does. */
const SOLANA_PLATFORM_BIN_CANDIDATES = [
  path.join(os.homedir(), '.local/share/solana/install/active_release/bin'),
];

function prependSolanaPlatformToolsToPath(): void {
  const sep = path.delimiter;
  const parts = (process.env.PATH ?? '').split(sep).filter(Boolean);
  for (const bin of SOLANA_PLATFORM_BIN_CANDIDATES) {
    const cargoBuildSbf = path.join(bin, 'cargo-build-sbf');
    if (fs.existsSync(cargoBuildSbf) && !parts.includes(bin)) {
      process.env.PATH = `${bin}${sep}${process.env.PATH ?? ''}`;
      return;
    }
  }
}

function assertCargoBuildSbfAvailable(): void {
  const res = spawnSync('cargo', ['build-sbf', '--version'], {
    encoding: 'utf8',
    shell: false,
  });
  if (res.status === 0) {
    return;
  }
  throw new Error(
    [
      '`cargo build-sbf` was not found. Homebrew `solana` only installs the CLI;',
      'Anchor needs the Agave release bundle (includes `cargo-build-sbf`).',
      '',
      'Install (official installer):',
      '  sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"',
      '',
      'Then put the toolchain on PATH (zsh/bash), e.g.:',
      '  export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"',
      '',
      'Open a new terminal and re-run: pnpm deploy:solana:devnet',
      '',
      'Match Anchor CLI to this repo (avoid AVM fallback to wrong CLI):',
      '  avm install 1.0.2 && avm use 1.0.2',
      '  # or: cargo install --git https://github.com/solana-foundation/anchor --tag v1.0.2 anchor-cli --locked',
    ].join('\n'),
  );
}

function programIdFromArtifact(crateName: string): PublicKey {
  const kpPath = path.join(SOLANA_WS, 'target/deploy', `${crateName}-keypair.json`);
  if (!fs.existsSync(kpPath)) {
    throw new Error(`Missing ${kpPath} — run anchor build first.`);
  }
  return loadKeypairBytes(kpPath).publicKey;
}

function uniqueSigners(keypairs: Keypair[]): Keypair[] {
  const seen = new Set<string>();
  const m: Keypair[] = [];
  for (const k of keypairs) {
    const b = k.publicKey.toBase58();
    if (!seen.has(b)) {
      seen.add(b);
      m.push(k);
    }
  }
  return m;
}

function assertValidPubkey(label: string, s: string): void {
  if (!s || /replace/i.test(s)) {
    throw new Error(
      `${label}: set a real base58 pubkey in the deploy JSON (not a placeholder).`,
    );
  }
  try {
    new PublicKey(s);
  } catch {
    throw new Error(`${label}: invalid base58 pubkey: ${s}`);
  }
}

function parsePubkeyArray(label: string, arr: string[]): PublicKey[] {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error(
      `${label}: use a non-empty array of base58 pubkeys (max 8 on-chain).`,
    );
  }
  if (arr.length > 8) {
    throw new Error(
      `${label}: at most 8 pubkeys (on-chain limit).`,
    );
  }
  const out: PublicKey[] = [];
  for (const s of arr) {
    assertValidPubkey(`${label}[]`, s);
    out.push(new PublicKey(s));
  }
  const bases = new Set(out.map((p) => p.toBase58()));
  if (bases.size !== out.length) {
    throw new Error(`${label}: duplicate pubkeys are not allowed.`);
  }
  return out;
}

async function main(): Promise<void> {
  const configPath = resolveConfigPath();
  const configDir = path.dirname(configPath);
  const cfg = loadJsonConfig(configPath);

  if (cfg.escrow.initialize) {
    assertValidPubkey('escrow.feeRecipient', cfg.escrow.feeRecipient);
    parsePubkeyArray('escrow.transactionAuthorities', cfg.escrow.transactionAuthorities);
    parsePubkeyArray(
      'escrow.authorizedNoderailsKeys',
      cfg.escrow.authorizedNoderailsKeys,
    );
  }

  const cluster = cfg.cluster;
  const anchorWalletPath = resolvePath(configDir, cfg.anchorWallet);

  prependSolanaPlatformToolsToPath();

  if (cfg.preDeploy.keysSync) {
    console.log('[1/5] anchor keys sync', cluster);
    run(
      'anchor',
      ['keys', 'sync', '--provider.cluster', cluster],
      SOLANA_WS,
    );
  }

  if (cfg.preDeploy.build) {
    assertCargoBuildSbfAvailable();
    console.log('[2/5] anchor build');
    run('anchor', ['build'], SOLANA_WS);
  }

  if (cfg.preDeploy.deploy) {
    const deployEscrow = cfg.escrow.deploy !== false;
    const deployMm = cfg.merchantManager.deploy !== false;
    const prog = cfg.preDeploy.programName?.trim();

    if (prog) {
      console.log(
        `[3/5] anchor deploy program only: ${prog} (preDeploy.programName overrides per-program deploy flags)`,
      );
      run('anchor', ['deploy', '-p', prog, '--provider.cluster', cluster, '--provider.wallet', anchorWalletPath], SOLANA_WS);
    } else if (!deployEscrow && !deployMm) {
      console.log('[3/5] skip anchor deploy (escrow.deploy and merchantManager.deploy are both false)');
    } else if (deployEscrow && deployMm) {
      console.log('[3/5] anchor deploy (all programs)');
      run('anchor', ['deploy', '--provider.cluster', cluster, '--provider.wallet', anchorWalletPath], SOLANA_WS);
    } else {
      if (deployEscrow) {
        console.log(`[3/5] anchor deploy program only: ${cfg.escrow.crate}`);
        run(
          'anchor',
          ['deploy', '-p', cfg.escrow.crate, '--provider.cluster', cluster, '--provider.wallet', anchorWalletPath],
          SOLANA_WS,
        );
      }
      if (deployMm) {
        console.log(`[3/5] anchor deploy program only: ${cfg.merchantManager.crate}`);
        run(
          'anchor',
          [
            'deploy',
            '-p',
            cfg.merchantManager.crate,
            '--provider.cluster',
            cluster,
            '--provider.wallet',
            anchorWalletPath,
          ],
          SOLANA_WS,
        );
      }
    }
  }

  const connection = new Connection(cfg.rpcUrl, 'confirmed');
  const deployer = loadKeypairBytes(anchorWalletPath);
  const wallet = new anchor.Wallet(deployer);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  anchor.setProvider(provider);

  const escrowProgId = programIdFromArtifact(cfg.escrow.crate);
  const mmProgId = programIdFromArtifact(cfg.merchantManager.crate);

  const escrowIdlPath = path.join(SOLANA_WS, 'target/idl', `${cfg.escrow.crate}.json`);
  const mmIdlPath = path.join(
    SOLANA_WS,
    'target/idl',
    `${cfg.merchantManager.crate}.json`,
  );

  if (cfg.escrow.initialize) {
    console.log('[4/5] escrow initialize (if needed)');
    const idl = JSON.parse(fs.readFileSync(escrowIdlPath, 'utf8'));
    idl.address = escrowProgId.toBase58();
    const program: anchor.Program = new anchor.Program(idl, provider);

    const cfgPda = PublicKey.findProgramAddressSync(
      [Buffer.from('cfg', 'utf8')],
      escrowProgId,
    )[0];
    const existing = await connection.getAccountInfo(cfgPda);
    if (existing) {
      console.log('  Escrow config PDA already exists, skipping initialize.');
    } else {
      const payer = loadKeypairBytes(
        resolvePath(configDir, cfg.escrow.payerKeypair),
      );
      const superAdmin = loadKeypairBytes(
        resolvePath(configDir, cfg.escrow.superAdminKeypair),
      );
      const feeRecipient = new PublicKey(cfg.escrow.feeRecipient);
      const transactionAuthorities = parsePubkeyArray(
        'escrow.transactionAuthorities',
        cfg.escrow.transactionAuthorities,
      );
      const authorizedNoderailsKeys = parsePubkeyArray(
        'escrow.authorizedNoderailsKeys',
        cfg.escrow.authorizedNoderailsKeys,
      );

      await program.methods
        .initialize(feeRecipient, transactionAuthorities, authorizedNoderailsKeys)
        .accounts({
          payer: payer.publicKey,
          superAdmin: superAdmin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers(uniqueSigners([payer, superAdmin]))
        .rpc();
      console.log('  Escrow initialized. Program', escrowProgId.toBase58());
    }
  }

  if (cfg.merchantManager.initialize) {
    console.log('[5/5] merchant_manager initialize (if needed)');
    const idl = JSON.parse(fs.readFileSync(mmIdlPath, 'utf8'));
    idl.address = mmProgId.toBase58();
    const program: anchor.Program = new anchor.Program(idl, provider);

    const mmCfg = PublicKey.findProgramAddressSync(
      [Buffer.from('mm_cfg', 'utf8')],
      mmProgId,
    )[0];
    const existing = await connection.getAccountInfo(mmCfg);
    if (existing) {
      console.log('  Merchant manager config PDA already exists, skipping initialize.');
    } else {
      const payer = loadKeypairBytes(
        resolvePath(configDir, cfg.merchantManager.payerKeypair),
      );
      const superAdmin = loadKeypairBytes(
        resolvePath(configDir, cfg.merchantManager.superAdminKeypair),
      );
      const firstAdmin = loadKeypairBytes(
        resolvePath(configDir, cfg.merchantManager.firstAdminKeypair),
      );

      if (superAdmin.publicKey.equals(firstAdmin.publicKey)) {
        throw new Error(
          'merchantManager.superAdminKeypair and firstAdminKeypair must be different pubkeys.',
        );
      }

      await program.methods
        .initialize()
        .accounts({
          payer: payer.publicKey,
          superAdmin: superAdmin.publicKey,
          firstAdmin: firstAdmin.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers(uniqueSigners([payer, superAdmin, firstAdmin]))
        .rpc();
      console.log('  Merchant manager initialized. Program', mmProgId.toBase58());
    }
  }

  console.log('\nDone.');
  console.log('Program IDs:', {
    escrow: escrowProgId.toBase58(),
    merchantManager: mmProgId.toBase58(),
  });
  console.log('Fetch IDL: anchor idl fetch', escrowProgId.toBase58(), '-o /tmp/escrow-idl.json');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
