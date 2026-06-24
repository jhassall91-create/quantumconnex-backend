// Commands are handled via Socket.IO in socket/index.js
// This controller is a placeholder for future REST-based command history

const getCommands = async (req, res) => {
    res.json({
        success: true,
        data: [],
        message: "Commands are processed via Socket.IO",
    });
};

module.exports = {
    getCommands,
};
