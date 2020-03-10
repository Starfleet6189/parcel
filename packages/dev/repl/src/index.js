/* eslint-disable import/first */
if (process.env.NODE_ENV === 'development') {
  require('preact/debug');
}

// eslint-disable-next-line no-unused-vars
import {h, render, Fragment} from 'preact';
import {useState, useEffect, useCallback, useReducer} from 'preact/hooks';
import Asset from './components/Asset';
import Options from './components/Options';
// import Preview from './components/Preview';
import {ParcelError, Notes, Graphs, useDebounce} from './components/helper';

import filesize from 'filesize';
import {
  PRESETS,
  hasBrowserslist,
  saveState,
  loadState,
  // downloadBuffer
} from './utils';
import {bundle, workerLoaded} from './parcel/';

async function downloadZip() {
  //   downloadBuffer('Parcel-REPL.zip', await getZip());
}

const BUNDLING_RUNNING = Symbol('BUNDLING_RUNNING');
const BUNDLING_SUCCESS = Symbol('BUNDLING_SUCCESS');

const WORKER_STATE_LOADING = Symbol('WORKER_STATE_LOADING');
const WORKER_STATE_SUCCESS = Symbol('WORKER_STATE_SUCCESS');
const WORKER_STATE_ERROR = Symbol('WORKER_STATE_ERROR');

const DEFAULT_PRESET = 'Javascript';

function updateAssets(assets, name, prop, value) {
  return assets.map(a => (a.name === name ? {...a, [prop]: value} : a));
}
function assetsReducer(assets, action) {
  if (action.type === 'changePreset') {
    return action.assets;
  } else if (action.type === 'updateAsset') {
    const {name, prop, value} = action;
    if (prop === 'name' && assets.find(a => a.name === value)) {
      return [...assets];
    } else {
      if (prop === 'content')
        assets = updateAssets(assets, name, 'time', Date.now());
      return updateAssets(assets, name, prop, value);
    }
  } else if (action.type === 'removeAsset') {
    const {name} = action;
    return assets.filter(a => a.name !== name);
  } else if (action.type === 'addAsset') {
    let nameIndex = 0;
    while (
      assets.find(
        v => v.name == 'new' + (nameIndex ? `-${nameIndex}` : '') + '.js',
      )
    ) {
      nameIndex++;
    }

    return [
      ...assets,
      {
        name: 'new' + (nameIndex ? `-${nameIndex}` : '') + '.js',
        content: '',
        isEntry: false,
      },
    ];
  }

  throw new Error('Unknown action');
}
assetsReducer.changePreset = assets => ({type: 'changePreset', assets});
assetsReducer.changeName = (name, newName) => ({
  type: 'updateAsset',
  name,
  prop: 'name',
  value: newName,
});
assetsReducer.changeContent = (name, content) => ({
  type: 'updateAsset',
  name,
  prop: 'content',
  value: content,
});
assetsReducer.changeEntry = (name, isEntry) => ({
  type: 'updateAsset',
  name,
  prop: 'isEntry',
  value: isEntry,
});
assetsReducer.remove = name => ({type: 'removeAsset', name});
assetsReducer.add = () => ({type: 'addAsset'});

function optionsReducer(options, {name, value}) {
  return {
    ...options,
    [name]: value,
  };
}
optionsReducer.update = (name, value) => ({name, value});

const initialHashState = loadState() || {};
function App() {
  const [assets, setAssets] = useReducer(
    assetsReducer,
    initialHashState.assets || PRESETS[DEFAULT_PRESET],
  );
  const [options, setOptions] = useReducer(
    optionsReducer,
    initialHashState.options || {
      minify: false,
      scopeHoist: true,
      sourceMaps: false,
      publicUrl: '',
      targetType: 'browsers',
      targetEnv: null,
      showGraphs: false,
    },
  );

  const [currentPreset, setCurrentPreset] = useState(
    initialHashState.currentPreset || DEFAULT_PRESET,
  );

  const [bundlingState, setBundlingState] = useState(BUNDLING_SUCCESS);
  const [workerState, setWorkerState] = useState(WORKER_STATE_LOADING);
  workerLoaded.then(
    () => setWorkerState(WORKER_STATE_SUCCESS),
    () => setWorkerState(WORKER_STATE_ERROR),
  );
  const [output, setOutput] = useState();

  const [installPrompt, setInstallPrompt] = useState(null);

  const assetsDebounced = useDebounce(assets, 500);
  useEffect(() => {
    saveState(currentPreset, options, assetsDebounced);
  }, [currentPreset, options, assetsDebounced]);
  // const hashChangeCb = useCallback(() => {
  //  let state = loadState();
  //  if (state) {
  //    console.log(state)
  //    setAssets(state.assets);
  //    setOptions(state.options);
  //    setCurrentPreset(state.currentPreset);
  //  }
  // }, []);
  // useEffect(() => {
  //  window.addEventListener("hashchange", hashChangeCb);
  //  return () => window.removeEventListener("hashchange", hashChangeCb);
  // }, []);

  const startBundling = useCallback(async () => {
    if (bundlingState === BUNDLING_RUNNING) return;
    setBundlingState(BUNDLING_RUNNING);

    try {
      const bundleOutput = await bundle(assets, options);

      // // await new Promise(async res => {
      // //   window.addEventListener(
      // //     'message',
      // //     e => {
      // //       console.log(e);
      // //       res();
      // //     },
      // //     {once: true}
      // //   );
      // // const sw = await navigator.serviceWorker.ready;
      // // if (sw.active) {
      // //   sw.active.postMessage(await getFS());
      // // }
      // // });

      setBundlingState(BUNDLING_SUCCESS);
      setOutput(bundleOutput);
    } catch (error) {
      setBundlingState(error);
      console.error(error);
    }
  }, [bundlingState, assets, options]);

  const keydownCb = useCallback(
    e => {
      if (e.metaKey) {
        if (e.code === 'Enter' || e.code === 'KeyB') {
          e.preventDefault();
          startBundling();
        } else if (e.code === 'KeyS') {
          e.preventDefault();
          // if (output) downloadZip();
        }
      }
    },
    [startBundling],
  );

  const beforeinstallpromptCb = useCallback(e => {
    e.preventDefault();
    setInstallPrompt(e);
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', keydownCb);
    window.addEventListener('beforeinstallprompt', beforeinstallpromptCb);
    return () => {
      document.removeEventListener('keydown', keydownCb);
      window.removeEventListener('beforeinstallprompt', beforeinstallpromptCb);
    };
  }, [beforeinstallpromptCb, keydownCb]);

  const changePresetCb = useCallback(e => {
    setOutput(null);
    setCurrentPreset(e.target.value);
    setAssets(assetsReducer.changePreset(PRESETS[e.target.value]));
    setBundlingState(null);
  }, []);

  const changeAssetNameCb = useCallback(
    (name, newName) => setAssets(assetsReducer.changeName(name, newName)),
    [],
  );
  const changeAssetContentCb = useCallback(
    (name, content) => setAssets(assetsReducer.changeContent(name, content)),
    [],
  );
  const changeAssetEntryCb = useCallback(
    (name, isEntry) => setAssets(assetsReducer.changeEntry(name, isEntry)),
    [],
  );
  const removeAssetCb = useCallback(
    name => setAssets(assetsReducer.remove(name)),
    [],
  );

  const addAssetCb = useCallback(() => setAssets(assetsReducer.add()), []);

  const changeOptionsCb = useCallback(
    (name, value) => setOptions(optionsReducer.update(name, value)),
    [],
  );

  const promptInstallCb = useCallback(async () => {
    installPrompt.prompt();

    const result = await this.state.installPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setInstallPrompt(null);
    }
  }, []);

  return (
    <div id="app">
      <div class="row">
        <label class="presets">
          <span>Preset:</span>
          <select onChange={changePresetCb} value={currentPreset}>
            {Object.keys(PRESETS).map(v => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {assets.map(({name, content, isEntry}, i) => (
          <Asset
            key={i}
            name={name}
            onChangeName={changeAssetNameCb}
            content={content}
            onChangeContent={changeAssetContentCb}
            editable
            isEntry={isEntry}
            onChangeEntry={changeAssetEntryCb}
            onClickRemove={removeAssetCb}
          />
        ))}
        <button class="addAsset" onClick={addAssetCb}>
          Add asset
        </button>
        <button
          class="start"
          disabled={bundlingState === BUNDLING_RUNNING}
          onClick={startBundling}
        >
          Bundle!
        </button>
        <Options
          values={options}
          onChange={changeOptionsCb}
          enableBrowserslist={!hasBrowserslist(assets)}
        />
        <Notes />
      </div>
      <div class="row">
        {workerState ? (
          <div class="loadState ready">Parcel is ready ?</div>
        ) : (
          <div class="loadState loading">Parcel is being loaded...</div>
        )}
        {(() => {
          if (bundlingState instanceof Error) {
            return <ParcelError error={bundlingState} />;
          } else if (bundlingState !== BUNDLING_RUNNING) {
            if (output) {
              return (
                <Fragment>
                  {output.assets.map(({name, content}) => (
                    <Asset
                      key={name}
                      name={name.trim()}
                      content={content}
                      additionalHeader={
                        <div class="outputSize">{filesize(content.length)}</div>
                      }
                    />
                  ))}
                  {output.graphs && <Graphs graphs={output.graphs} />}
                  {/* <Preview output={output.assets} options={options} /> */}
                  <button disabled onClick={downloadZip}>
                    Download ZIP
                  </button>
                </Fragment>
              );
            } else {
              return (
                <div class="file gettingStarted">
                  <div>
                    Click on{' '}
                    <button
                      class="start"
                      disabled={bundlingState === BUNDLING_RUNNING}
                      onClick={startBundling}
                    >
                      Bundle!
                    </button>{' '}
                    to get started!
                  </div>
                </div>
              );
            }
          }
        })()}
        {installPrompt && (
          <button class="installPrompt" onClick={promptInstallCb} disabled>
            Want to add this to your homescreen?
          </button>
        )}
      </div>
    </div>
  );
}

render(<App />, document.getElementById('root'));

// if ('serviceWorker' in navigator) {
//   navigator.serviceWorker.register('./sw.js').catch(error => {
//     // eslint-disable-next-line no-console
//     console.error('Service worker registration failed:', error);
//   });
// }
