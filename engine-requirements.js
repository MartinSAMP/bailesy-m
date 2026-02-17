// Check if running with Bun or Node.js
if (typeof Bun !== 'undefined') {
    const bunVersion = Bun.version;
    const major = parseInt(bunVersion.split(".")[0], 10);
    const minor = parseInt(bunVersion.split(".")[1], 10);

    if (major < 1 || (major === 1 && minor < 3)) {
        console.error(
            "\n========================================\n" +
            " Baileys requires Bun 1.3+ to run       \n" +
            "----------------------------------------\n" +
            `   You are using Bun ${bunVersion}\n` +
            "   Please upgrade to Bun 1.3+ to proceed.\n" +
            "========================================\n"
        );
        process.exit(1);
    }

    console.log(`✓ Running with Bun ${bunVersion}`);
} else if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    const nodeVersion = process.versions.node;
    const major = parseInt(nodeVersion.split(".")[0], 10);

    if (major < 18) {
        console.error(
            "\n========================================\n" +
            " Baileys requires Node.js 18+ to run    \n" +
            "----------------------------------------\n" +
            `   You are using Node.js ${nodeVersion}\n` +
            "   Please upgrade to Node.js 18+ to proceed.\n" +
            "========================================\n"
        );
        process.exit(1);
    }

    console.log(`✓ Running with Node.js ${nodeVersion}`);
} else {
    console.error(
        "\n========================================\n" +
        " Unknown JavaScript runtime detected     \n" +
        "----------------------------------------\n" +
        "   Baileys requires Bun 1.3+ or Node.js 18+\n" +
        "========================================\n"
    );
    process.exit(1);
}