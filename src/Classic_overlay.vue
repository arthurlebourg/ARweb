<template>
    <div class="CLASSIC_DOM">
        <fieldset>
            <legend>Select an action:</legend>
            <div>
                <input type="radio" id="place" name="action" value="place" checked>
                <label for="place">Place Object</label>
            </div>
    
            <div>
                <input type="radio" id="measure" name="action" value="measure">
                <label for="measure">Measure Distance</label>
            </div>

            <div>
                <input type="radio" id="write_text" name="action" value="write_text">
                <label for="write_text">Write some text</label>
                <input type="text" id="write_text_data" placeholder="text to write">
            </div>
        </fieldset>
        <video id="remoteVideo" class="clickable" autoplay style="height:100vh;"></video>
    </div>
</template>