module.exports = {
    execute: async (command) => {
        return {
            success: false,
            message:
                "iOS adapter not implemented yet",
            command,
        };
    },
};